/*!
 * Searchable Map Template with Google Fusion Tables
 * http://derekeder.com/searchable_map_template/
 *
 * Copyright 2012, Derek Eder
 * Licensed under the MIT license.
 * https://github.com/derekeder/FusionTable-Map-Template/wiki/License
 *
 * Date: 12/10/2012
 *
 */

var MapsLib = MapsLib || {};
var MapsLib = {

  //Setup section - put your Fusion Table details here
  //Using the v1 Fusion Tables API. See https://developers.google.com/fusiontables/docs/v1/migration_guide for more info

  //the encrypted Table ID of your Fusion Table (found under File => About)
  //NOTE: numeric IDs will be depricated soon
  fusionTableId:      "1YTu1FnBovWboMdQHdWO7i3uc4tGknjtnNjU_FGM",

  //*New Fusion Tables Requirement* API key. found at https://code.google.com/apis/console/
  //*Important* this key is for demonstration purposes. please register your own.
  googleApiKey:       "AIzaSyBHnYpEqDQaRrMF_TNRvbTZhmPEKEsw_2E",

  //name of the location column in your Fusion Table.
  //NOTE: if your location column name has spaces in it, surround it with single quotes
  //example: locationColumn:     "'my location'",
  locationColumn:     "geometry",

  map_centroid:       new google.maps.LatLng(38.40625379485267, -98.2383671845704), //center that your map defaults to
  locationScope:      "",      //geographical area appended to all address searches
  recordName:         "result",       //for showing number of results
  recordNamePlural:   "results",

  searchRadius:       5,            //in meters; orignal default 805 ~ 1/2 mile
  defaultZoom:        7,             //zoom level when map is loaded (bigger is more zoomed in)
  addrMarkerImage: 'http://derekeder.com/images/icons/blue-pushpin.png',
  currentPinpoint: null,

  initialize: function() {
    $( "#result_count" ).html("");
$("#rbType1").attr("checked", "checked");
    $("#results_list").hide();
    $("#result_count").hide();

    geocoder = new google.maps.Geocoder();
    var myOptions = {
      zoom: MapsLib.defaultZoom,
      center: MapsLib.map_centroid,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map($("#map_canvas")[0],myOptions);

    // maintains map centerpoint for responsive design
    google.maps.event.addDomListener(map, 'idle', function() {
        MapsLib.calculateCenter();
    });

    google.maps.event.addDomListener(window, 'resize', function() {
        map.setCenter(MapsLib.map_centroid);
    });

    MapsLib.searchrecords = null;

    //reset filters
    $("#search_address").val(MapsLib.convertToPlainString($.address.parameter('address')));
    var loadRadius = MapsLib.convertToPlainString($.address.parameter('radius'));
    if (loadRadius != "") $("#search_radius").val(loadRadius);
    else $("#search_radius").val(MapsLib.searchRadius);
    $(":checkbox").attr("checked", "checked"); $("#results_list").hide();
    $("#result_count").hide(); 
	

    //run the default search
    MapsLib.doSearch();
  },

  doSearch: function(location) {
    MapsLib.clearSearch();
    var address = $("#search_address").val();
    MapsLib.searchRadius = $("#search_radius").val();

    var whereClause = MapsLib.locationColumn + " not equal to ''";

    //-----custom filters-------
//var type_column = "'Party'";
//var tempWhereClause = [];
//if ( $("#cbType1").is(':checked')) tempWhereClause.push("Democrat");
//if ( $("#cbType2").is(':checked')) tempWhereClause.push("Republican");
//if ( $("#cbType3").is(':checked')) tempWhereClause.push("Male");
//if ( $("#cbType4").is(':checked')) tempWhereClause.push("Female");
//whereClause += " AND " + type_column + " IN ('" + tempWhereClause.join('\',\'') + "')";

var type_column = "'Party'";
var tempWhereClause = [];
if ( $("#cbType1").is(':checked')) tempWhereClause.push("Democrat");
if ( $("#cbType2").is(':checked')) tempWhereClause.push("Republican");
whereClause += " AND " + type_column + " IN ('" + tempWhereClause.join('\',\'') + "')";

var type_column = "'Gender'";
var tempWhereClause = [];
if ( $("#cbType3").is(':checked')) tempWhereClause.push("Male");
if ( $("#cbType4").is(':checked')) tempWhereClause.push("Female");
whereClause += " AND " + type_column + " IN ('" + tempWhereClause.join('\',\'') + "')";

var type_column = "'Race/Ethnicity'";
var tempWhereClause = [];
if ( $("#cbType5").is(':checked')) tempWhereClause.push("White");
if ( $("#cbType6").is(':checked')) tempWhereClause.push("Black");
if ( $("#cbType7").is(':checked')) tempWhereClause.push("Hispanic");
if ( $("#cbType8").is(':checked')) tempWhereClause.push("Asian/Pacific Islander");
whereClause += " AND " + type_column + " IN ('" + tempWhereClause.join('\',\'') + "')";


    //-------end of custom filters--------

    if (address != "") {
      if (address.toLowerCase().indexOf(MapsLib.locationScope) == -1)
        address = address + " " + MapsLib.locationScope;

      geocoder.geocode( { 'address': address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
          MapsLib.currentPinpoint = results[0].geometry.location;

          $.address.parameter('address', encodeURIComponent(address));
          $.address.parameter('radius', encodeURIComponent(MapsLib.searchRadius));
          map.setCenter(MapsLib.currentPinpoint);
          map.setZoom(14);

          MapsLib.addrMarker = new google.maps.Marker({
            position: MapsLib.currentPinpoint,
            map: map,
            icon: MapsLib.addrMarkerImage,
            animation: google.maps.Animation.DROP,
            title:address
          });

          whereClause += " AND ST_INTERSECTS(" + MapsLib.locationColumn + ", CIRCLE(LATLNG" + MapsLib.currentPinpoint.toString() + "," + MapsLib.searchRadius + "))";

          MapsLib.drawSearchRadiusCircle(MapsLib.currentPinpoint);
          MapsLib.submitSearch(whereClause, map, MapsLib.currentPinpoint);
        }
        else {
          alert("We could not find your address: " + status);
        }
      });
    }
    else { //search without geocoding callback
      MapsLib.submitSearch(whereClause, map);
    }
  },

  submitSearch: function(whereClause, map, location) {
    //get using all filters
    //NOTE: styleId and templateId are recently added attributes to load custom marker styles and info windows
    //you can find your Ids inside the link generated by the 'Publish' option in Fusion Tables
    //for more details, see https://developers.google.com/fusiontables/docs/v1/using#WorkingStyles

    MapsLib.searchrecords = new google.maps.FusionTablesLayer({
      query: {
        from:   MapsLib.fusionTableId,
        select: MapsLib.locationColumn,
        where:  whereClause
      },
      styleId: 2,
      templateId: 2
    });
    MapsLib.searchrecords.setMap(map);
    MapsLib.getCount(whereClause);
	MapsLib.getList(whereClause);
  },

  clearSearch: function() {
    if (MapsLib.searchrecords != null)
      MapsLib.searchrecords.setMap(null);
    if (MapsLib.addrMarker != null)
      MapsLib.addrMarker.setMap(null);
    if (MapsLib.searchRadiusCircle != null)
      MapsLib.searchRadiusCircle.setMap(null);
  },

  findMe: function() {
    // Try W3C Geolocation (Preferred)
    var foundLocation;

    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        foundLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        MapsLib.addrFromLatLng(foundLocation);
      }, null);
    }
    else {
      alert("Sorry, we could not find your location.");
    }
  },

  addrFromLatLng: function(latLngPoint) {
    geocoder.geocode({'latLng': latLngPoint}, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          $('#search_address').val(results[1].formatted_address);
          $('.hint').focus();
          MapsLib.doSearch();
        }
      } else {
        alert("Geocoder failed due to: " + status);
      }
    });
  },

  drawSearchRadiusCircle: function(point) {
      var circleOptions = {
        strokeColor: "#4b58a6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: "#4b58a6",
        fillOpacity: 0.05,
        map: map,
        center: point,
        clickable: false,
        zIndex: -1,
        radius: parseInt(MapsLib.searchRadius)
      };
      MapsLib.searchRadiusCircle = new google.maps.Circle(circleOptions);
  },

  query: function(selectColumns, whereClause, callback) {
    var queryStr = [];
    queryStr.push("SELECT " + selectColumns);
    queryStr.push(" FROM " + MapsLib.fusionTableId);
    queryStr.push(" WHERE " + whereClause);

    var sql = encodeURIComponent(queryStr.join(" "));
    $.ajax({url: "https://www.googleapis.com/fusiontables/v1/query?sql="+sql+"&callback="+callback+"&key="+MapsLib.googleApiKey, dataType: "jsonp"});
  },

  handleError: function(json) {
    if (json["error"] != undefined) {
      var error = json["error"]["errors"]
      console.log("Error in Fusion Table call!");
      for (var row in error) {
        console.log(" Domain: " + error[row]["domain"]);
        console.log(" Reason: " + error[row]["reason"]);
        console.log(" Message: " + error[row]["message"]);
      }
    }
  },

  getCount: function(whereClause) {
    var selectColumns = "Count()";
    MapsLib.query(selectColumns, whereClause,"MapsLib.displaySearchCount");
  },

  displaySearchCount: function(json) {
    MapsLib.handleError(json);
    var numRows = 0;
    if (json["rows"] != null)
      numRows = json["rows"][0];

    var name = MapsLib.recordNamePlural;
    if (numRows == 1)
    name = MapsLib.recordName;
    $( "#result_count" ).fadeOut(function() {
        $( "#result_count" ).html(MapsLib.addCommas(numRows) + " " + name + " found");
      });
    $( "#result_count" ).fadeIn();
  },

getList: function(whereClause) {
  var selectColumns = "First_Name, Last_Name, District, Party, Gender, Photo, Phone, Email, Webpage ";
  MapsLib.query(selectColumns, whereClause, "MapsLib.displayList");
},

displayList: function(json) {
  MapsLib.handleError(json);
  var data = json["rows"];
  var template = "";

  var results = $("#results_list");
  results.hide().empty(); //hide the existing list and empty it out first

  if (data == null) {
    //clear results list
    results.append("<li><span class='lead'>No results found</span></li>");
  }
  else {
    for (var row in data) {
      template = "\
        <div class='row-fluid item-list'>\
          <div class='span12'>\
		  	<img class='photo-tn' src='" + data[row][5] + "' />" + "\
            <strong>" + "Senator: " + "</strong>" + data[row][0] + " " + data[row][1] + "\
            <br />\
            <strong>" + "District: " + "</strong>" + data[row][2] + "\
            <br />\
            <strong>" + "Party: " + "</strong>" + data[row][3] + "\
			<br />\
            <strong>" + "Gender: " + "</strong>" + data[row][4] + "\
			<br />\
            <strong>" + "Phone: " + "</strong>" + data[row][6] + "\
			<br />\
            <strong>" + "Email: " + "</strong> <a href='mailto:" + data[row][7] + "'>Click Here</a>" + "\
			<br />\
            <strong>" + "Webpage: " + "</strong> <a href='" + data[row][8] + "'>Link</a>" + "\
          <hr>\
		  </div>\
        </div>"
      results.append(template);
    }
  }
  results.fadeIn();
},

  addCommas: function(nStr) {
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  },

  // maintains map centerpoint for responsive design
  calculateCenter: function() {
    center = map.getCenter();
  },

  //converts a slug or query string in to readable text
  convertToPlainString: function(text) {
    if (text == undefined) return '';
  	return decodeURIComponent(text);
  }  
}
