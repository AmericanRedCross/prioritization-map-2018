// data+code oddities...
// >> click Mali and American Red Cross
// >> duplicate competencies?

// global variables
var world, inform, countryMapping, competencies, competencySlider, nsLookup;
var groupToggles = document.getElementsByClassName('group-toggle');
var rows;

var scoreLookup = {};
var sliders = [];
var rankingArrays = {
  world: []
};

var defaultFill = '#f5f5f5';
var zeroFill = '#000000';

var regionFilter = "world";

var worldChart = dc.leafletChoroplethChart("#world-chart");
var donorChart = dc.rowChart('#donor-chart');
var howChart = dc.pieChart('#how-chart');

var quantize = d3.scale.quantize()
    .range(["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"]);

// initialize the Leaflet risk map
var riskMap = L.map('risk-map').setView([0, 0], 2);
// initialize the SVG layer for D3 drawn markers
L.svg().addTo(riskMap);
// set up svg
var svg = d3.select('#risk-map').select("svg"),
    mappedGeo = svg.append("g").attr("id", "countries");

// Use Leaflet to implement a D3 geometric transformation.
function projectPoint(x, y){
  var point = riskMap.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);

var noDecimal = d3.format(",d");
var oneDecimal = d3.format("00.1f");
var twoDecimal = d3.format("00.2f");


//risk viz setup
var defaults = {
  inform: { weight: 1 }, // ## category (0 or 1)
  natural: { weight: 1, title: "Natural disaster exposure", color:"#08519c" },
  conflict: { weight: 1, title: "Conflict", color:"#2171b5" },
  socioecon: { weight: 1, title: "Socio-economic vulnerability", color:"#4292c6" },
  vuln: { weight: 1, title: "Demographic vulnerability", color:"#9ecae1" },
  institutional: { weight: 1, title: "Lack of institutional coping capacity", color:"#c6dbef" },
  infra: { weight: 1, title: "Lack of infrastructure coping capacity", color:"#deebf7" }
};
// copy the object so we can store new weightings but also keep track of the defaults
// for reset witout page refresh
var weightings={}
for(key in defaults){
  weightings[key] = defaults[key].weight;
}

var graphSegments = ["natural","conflict","socioecon","vuln","institutional","infra"];

$.each(graphSegments, function(i, segment){
  sliderSearch = "#" + segment + ".sliders";
  $(sliderSearch).css("background", defaults[segment].color)
});

function quickSetSliders(option){
  $(sliders).each(function(index, item){
    if(option === 'default'){
      var category = $(item).attr("id");
      item.noUiSlider.set(defaults[category].weight);
      d3.selectAll('.toggle-group').classed({'fa-toggle-on':true, 'fa-toggle-off':false});
    }
    if(option === 'zero'){
      item.noUiSlider.set(0);
    }
  });
  setWeighting();
}






/* GRAB DATA SOURCES */
queue()
  .defer(d3.json, nginxlocation + "data/ne_50m-simple-topo.json")
  .defer(d3.csv, nginxlocation + "data/INFORM_2019_v036.csv")
  .defer(d3.json, nginxlocation + "map/country-mapping")
  .defer(d3.json, nginxlocation + "map/competencies")
  .await(getData);

function getNumber(str){
  var noCommas = str.replace(/,/g,'');
  return (isNaN(parseFloat(noCommas))) ? 0 : parseFloat(noCommas);
}

/* FORMAT DATA */
function getData(err, data1, data2, data3, data4){
  // save data to global variables
  world = topojson.feature(data1, data1.objects.ne_50m);
  inform = [];
  countryMapping = data3;
  competencies = data4;
  nsLookup = d3.nest()
    .key(function(d) { return d['donor-iso']; })
    .map(countryMapping);

  data2.forEach(function(d){
    var rowObject = {
        iso: d.iso,
        name: d.name,
        natural: getNumber(d.natural),
        conflict: getNumber(d.conflict),
        socioecon: getNumber(d.socioecon),
        vuln: getNumber(d.vuln),
        institutional: getNumber(d.institutional),
        infra: getNumber(d.infra)
      }
    var defaultsExclude = ["inform"];
    var missingData = [];
    for(key in defaults){
      if($.inArray(key, defaultsExclude) === -1){
        if(d[key] === "#N/A"){
          missingData.push(defaults[key].title)
        }
      }
    }
    rowObject.missing = missingData;
    inform.push(rowObject)
  })

  // parse strings to numbers
  countryMapping.forEach(function(d){
    d.euro = getNumber(d.euro);
  })

  setupCompetencySliders();
}


function setupCompetencySliders(){
  competencySlider = document.getElementById('competency-slider');
  noUiSlider.create(document.getElementById('competency-slider'), {
    start: 3,
    connect: "lower",
    step: 1,
    tooltip: true,
    orientation: "horizontal",
    range: { 'min':1, 'max':5 },
    format: {
  	  to: function ( value ) {
  		return d3.format("")(value);
  	  },
  	  from: function ( value ) {
  		return d3.format("")(value);
  	  }
  	}
  });
  competencySlider.noUiSlider.on('update', function( values, handle ) {
  	document.getElementById('competency-filter').innerHTML = values[handle];
  });
  var showLevel = document.getElementById('competency-filter')
  competencySlider.noUiSlider.on('slide', renderCompetencies);

  setupInformSliders();
}

function setupInformSliders(){
  // only the subcategories have elements on the page classed sliders
  sliders = document.getElementsByClassName('sliders');
  for ( var i = 0; i < sliders.length; i++ ) {
    var category = $(sliders[i]).attr("id");
    var defaultWeighting = weightings[category];
  	noUiSlider.create(sliders[i], {
  		start: defaultWeighting,
  		connect: "lower",
      step: 1,
      tooltip: true,
  		orientation: "horizontal",
  		range: { 'min':0, 'max':5 }
  	});

  	// Bind the color changing function to the slide event.
  	sliders[i].noUiSlider.on('slide', setWeighting);
  }

  drawRisksMap();
}

function drawRisksMap(){
  var country = mappedGeo.selectAll(".country").data(world.features)
  country.enter().insert("path")
    .attr("class", "country")
    .attr("d", path)
    .on("mouseover", function(d){
        populateMapTooltip(d, this);
      })
    .on("mouseout", function(d){
      $('#tooltip').empty();
    });

  updatePath = function(){ country.attr("d", path); }
  riskMap.on('zoom move viewreset', updatePath);

  drawInvestments();
}

function renderCompetencies(){

  filteredCountries = d3.nest().key(function(d){ return d["country-iso"];}).map(cf.allFiltered());
  rows.each(function(d){
    if(filteredCountries[d.iso] === undefined){
      d3.select(this).classed("highlight-country-name", false)
    } else {
      d3.select(this).classed("highlight-country-name", true)
    }
  })

  var levelFilter = parseInt(competencySlider.noUiSlider.get());

  filteredDonors = d3.nest().key(function(d){ return d["donor-iso"];}).map(cf.allFiltered());
  filteredCompetencies = competencies.filter(function(d){ return filteredDonors[d["donor-iso"]] && parseInt(d.expertise) >= levelFilter; });
  competencyNest = d3.nest().key(function(d){ return d.competency; }).entries(filteredCompetencies);



  // JOIN new data with old elements.
  competencyRows = d3.select('#competency-chart').selectAll('div')
    .data(competencyNest, function(d){ return d.key; })
    .classed('competency-row', true);

  // EXIT old elements not present in new data.
  competencyRows.exit().remove();

  // UPDATE old elements present in new data.
  competencyRows.html(function(d){
    return "<span class='competency-info'><i class='fas fa-info-circle'></i>" +  " <small>[" + d.values.length + "] </small></span>" + d.key ;
  })

  // ENTER new elements present in new data.
  competencyRows.enter().append("div").html(function(d){
    return "<span class='competency-info'><i class='fas fa-info-circle'></i>" +  " <small>[" + d.values.length + "] </small></span>" + d.key ;
  })

  competencyRows.on("mouseover", function(d){
        var tooltipText = "<strong>Donor NS and self-rating</strong><br><small>";
        var donorArray = [];
        d.values.forEach(function(d){
          var donorIso = d['donor-iso'];
          var donorName = nsLookup[donorIso][0]['donor-ns'];
          donorArray.push(donorName + ' (' + d.expertise + ')');
        });
        tooltipText += donorArray.join(', ') + '</small>';
        $('#tooltip-competency').append(tooltipText);
      })
      .on("mouseout", function(d){
        $('#tooltip-competency').empty();
      });

  competencyRows.sort(function(a,b){
    // sort from most frequent competency among donors
    if (a.values.length < b.values.length) return 1;
    if (a.values.length > b.values.length) return -1;
    // then if equal sort comptencies alphabetically
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
  })

  d3.selectAll('.competency-info')
    .on("mouseover", function(d){
      $('#tooltip-competency').show();
    })
    .on("mouseout", function(d){
      $('#tooltip-competency').hide();
    });

}

function drawInvestments(){

  cf = crossfilter(countryMapping);
  cf.onChange(function(){
      renderCompetencies();
  });

  countriesDimension = cf.dimension(function(d){
    return d["country-iso"];
  });
  donorDimension = cf.dimension(function(d){
    return d["donor-ns"];
  });
  howDimension = cf.dimension(function(d){
    return d["how"];
  });
  euroDimension = cf.dimension(function(d){ 
    return Math.round(d["euro"]); 
  });

  countryEuroGroup = countriesDimension.group().reduceSum(function(d){
    return Math.round(d["euro"]);
  });
  donorEurosGroup = donorDimension.group().reduceSum(function(d){
    return Math.round(d["euro"]);
  });
  howGroup = howDimension.group();
  euroGroup = euroDimension.groupAll().reduceSum(function(d){
    return Math.round(d["euro"]);
  });
  

  var donorChartWidth = document.getElementById('donor-chart').offsetWidth - 20;
  donorChart
    .width(donorChartWidth)
    .height(400)
    .dimension(donorDimension)
    .group(donorEurosGroup)
    .elasticX(true)
    .elasticX(true)
    .colors(['#CCCCCC', '#ae0e1c'])
    .colorDomain([0,1])
    .colorAccessor(function(d, i){return 1;})
    .ordering(function(d){ return -d.value })
    .xAxis().ticks(4)
    

  worldChart
    .width(null)
    .height(500)
    .center([50.09024, -95.712891])
    .zoom(3)
    .dimension(countriesDimension)
    .group(countryEuroGroup)
    .colors(function(d){
      var colorScale = d3.scale.quantize()
          .range(["#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"])
          // .domain([0, d3.max(countryMapping, function(d){ return d.euro; })])
          .domain([0, countryEuroGroup.top(1)[0].value])
      if(d == 0){
        return "#ccc"
      }else{
        return colorScale(d);
      }
    })
    .colorAccessor(function(d){ return d; })
    .geojson(world)
    .featureKeyAccessor(function(feature){
      return feature.properties.iso;
    })
    .title(function(d){
      return d.properties.name;
    })
    .on('renderlet', function () {
      d3.select("#euroTotal").text(noDecimal(euroGroup.value()));
    });

    var distinct = []
    for (var i = 0; i < countryMapping.length; i++){
      if ($.inArray(countryMapping[i].how, distinct) === -1){
        distinct.push(countryMapping[i].how);
      }

    }

    howChart
      .width(null)
      .height(null)
      .renderLabel(false)
      .colors(d3.scale.ordinal().range(["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3"]))  
      .colorDomain(distinct)
      .slicesCap(5)
      .externalLabels(50)
      .externalRadiusPadding(50)
      .drawPaths(true)
      .dimension(howDimension)
      .group(howGroup)
      .legend(dc.legend());

    dc.renderAll();




    worldChart.map().eachLayer(function(layer){
      if( layer instanceof L.TileLayer ){  worldChart.map().removeLayer(layer); }
    });
    riskMap.sync(worldChart.map())
    worldChart.map().sync(riskMap)

    buildTable();
}

function buildTable(){

    rows = d3.select('#inform-chart').selectAll('div')
      .data(inform, function(d){ return d.iso; }).enter()
      .append('div')
      .attr('id', function(d){ return "row-" + d.iso; })
      .classed({"grid-x":true,"graph-row":true})
      .attr('data-score',0)
      .html(function(d){
        graphSegmentsHtml = "";
        for(var i=0; i<graphSegments.length; i++){
          var thisSegmentHtml = '<div class="graph-segment ' + graphSegments[i] + "W" +
          '" style="background-color:' + defaults[graphSegments[i]].color + '; width:0%;" data-label="' + defaults[graphSegments[i]].title + '" data-score=""></div>';
          graphSegmentsHtml += thisSegmentHtml;
        }
        html = '<div class="cell small-4 graph-text-col"><span class="text-span">' + d.name + ' ';

        html += (d.missing.length > 0) ? '<i class="fa fa-info fa-fw data-missing-icon" data-missing="' + d.missing.join(", ") + '"></i>' : '';
        html += ' - <span class="score-text"></span></span></div>' +
        '<div class="cell small-8 graph-bar-col">' + graphSegmentsHtml  + "</div></div>";
        return html;
      })

      d3.selectAll(".graph-segment").on("mouseover", function(d){
        var tooltipText = "<small><b>" + $(this).attr("data-label") + "</b> - " + $(this).attr("data-score") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

      d3.selectAll(".data-missing-icon").on("mouseover", function(d){
        var tooltipText = "<small><b>No data available:</b> " + $(this).attr("data-missing") + "</small>";
        $('#tooltip').html(tooltipText);
      }).on("mouseout", function(){
        $('#tooltip').empty();
      });

  renderCompetencies();
  setWeighting();
}



function setWeighting(){

  $(groupToggles).each(function(index, item){
    var category = $(item).attr("id");
    var weight = ($(item).hasClass("fa-toggle-on")) ? 1 : 0;
    weightings[category] = weight;
  });

  $(sliders).each(function(index, item){
    var category = $(item).attr("id");
    var weight = item.noUiSlider.get();
    var spanSelector = ".weight." + category;
    d3.select(spanSelector).html(noDecimal(weight));
    weightings[category] = parseFloat(weight);
  });

  d3.selectAll('.sliders').classed('null-slider', false);
  if(weightings.inform === 0){
    d3.selectAll('.sliders.inform').classed('null-slider', true);
  }

  adjustScores();
}

function adjustScores(){

  rankingArrays.world = [];

  $.each(inform, function(countryIndex, country){
    var weightingsSum = (weightings.inform * (weightings.natural + weightings.conflict + weightings.socioecon + weightings.vuln + weightings.institutional + weightings.infra))
    // weighting for inform will be 1-0 for on-off
    country.naturalW =  weightings.inform * (weightings.natural * country.natural / weightingsSum);
    country.conflictW =  weightings.inform * (weightings.conflict * country.conflict / weightingsSum);
    country.socioeconW = weightings.inform * (weightings.socioecon * country.socioecon / weightingsSum);
    country.vulnW = weightings.inform * (weightings.vuln * country.vuln / weightingsSum);
    country.institutionalW = weightings.inform * (weightings.institutional * country.institutional / weightingsSum);
    country.infraW = weightings.inform * (weightings.infra * country.infra / weightingsSum);

    for(var i=0; i<graphSegments.length; i++){
      subCat = graphSegments[i] + "W";
      if(isNaN(country[subCat])){ country[subCat] = 0;};
    }
    country.score = country.naturalW + country.conflictW + country.socioeconW + country.vulnW + country.institutionalW + country.infraW;
    scoreLookup[country.iso] = country.score;
    if($.inArray(country.score, rankingArrays.world) === -1){rankingArrays.world.push(country.score)}
  });

  rankingArrays.world.sort(function(a, b) { return b - a; })

  updateTable();
}



function updateTable(){

  // UPDATED DATA JOIN
  rows.data(inform, function(d){ return d.iso; });

  rows.each(function(d){
    // console.log(d)
    // console.log(d.score)
    d3.select(this).select('.score-text').text(oneDecimal(d.score));
    for(var i=0; i<graphSegments.length; i++){
      selector = ".graph-segment." + graphSegments[i] + "W";
      segmentWidth = d[graphSegments[i] + "W"] * 10 + "%"
      d3.select(this).select(selector)
        .style('width',segmentWidth)
        .attr('data-score', twoDecimal(d[graphSegments[i] + "W"]))
    }

  })

  rows.sort(function(a,b){
    return b.score - a.score;
  })

  updateMapColors();
}

function updateMapColors(){

  quantize.domain([
      // d3.min(d3.values(countryData), function(d) { return d.score; }),
      // d3.max(d3.values(countryData), function(d) { return d.score; })
      d3.min(rankingArrays[regionFilter]),
      d3.max(rankingArrays[regionFilter])
    ]);
  if(quantize.domain()[0] === 0 && quantize.domain()[1] === 0) {quantize.domain([0,1])}
  mappedGeo.selectAll('.country').each(function(d,i){
    if(scoreLookup[d.properties.iso] || scoreLookup[d.properties.iso] === 0){
      // index starts at 0, ranking starts at 1, so add 1
      var rank = $.inArray(scoreLookup[d.properties.iso], rankingArrays.world) + 1;
      var regionRank = null;
      if(d.properties.region !== "null"){
        regionRank = $.inArray(scoreLookup[d.properties.iso], rankingArrays[d.properties.region ]) + 1;
      }
      d3.select(this).attr('data-score', scoreLookup[d.properties.iso])
        .attr('data-rank', rank)
        .attr('data-region-rank', regionRank)
        .style("fill", function(d){
          if(regionFilter === "world" || d.properties.region === regionFilter){
            return quantize(scoreLookup[d.properties.iso]);
          } else { return defaultFill }
        })
    } else {
      d3.select(this).style("fill", function(d){
        return defaultFill;
      })
      .attr('data-score', '');
    }
  })

  svg.selectAll('.locator').each(function(d,i){
    if(scoreLookup[d.properties.iso] || scoreLookup[d.properties.iso] === 0){
      // index starts at 0, ranking starts at 1, so add 1
      var rank = $.inArray(scoreLookup[d.properties.iso], rankingArrays.world) + 1;
      var regionRank = null;
      if(d.properties.region !== "null"){
        regionRank = $.inArray(scoreLookup[d.properties.iso], rankingArrays[d.properties.region ]) + 1;
      }
      d3.select(this).attr('data-score', scoreLookup[d.properties.iso])
        .attr('data-rank', rank)
        .attr('data-region-rank', regionRank);
    } else {
      d3.select(this).attr('data-score', '');
    }
  });

}





function redraw() {
  var donorChartWidth = document.getElementById('donor-chart').offsetWidth - 20;
  donorChart.width(donorChartWidth);
  donorChart.redraw();
}

function resetDc() {
  dc.filterAll();
  dc.redrawAll();
}

d3.select(window).on("resize", throttle);
var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
    throttleTimer = window.setTimeout(function() {
      redraw();
    }, 200);
}

// toggle grouping on or off
function toggleGroup(el){
  var toggle = d3.select(el);
  if(toggle.classed('fa-toggle-on')){
    toggle.classed({'fa-toggle-on':false, 'fa-toggle-off':true});
  } else { toggle.classed({'fa-toggle-on':true, 'fa-toggle-off':false}); }

  setWeighting();
}

// tooltip follows cursor
$(document).ready(function() {
    $('body').mouseover(function(e) {
        //Set the X and Y axis of the tooltip
        $('#tooltip').css('top', e.pageY + 10 );
        $('#tooltip').css('left', e.pageX + 20 );
        $('#tooltip-competency').css('top', e.pageY + 10 );
        $('#tooltip-competency').css('left', e.pageX + 20 );
    }).mousemove(function(e) {
        //Keep changing the X and Y axis for the tooltip, thus, the tooltip move along with the mouse
        $("#tooltip").css({top:(e.pageY+15)+"px",left:(e.pageX+20)+"px"});
        $("#tooltip-competency").css({top:(e.pageY+15)+"px",left:(e.pageX+20)+"px"});

    });
});

function populateMapTooltip(d, el){

  var tooltipText = "<strong>" + d.properties.name + " - <small>";
  var score = d3.select(el).attr('data-score');
  tooltipText += score ? oneDecimal(score) + ' | <i class="fa fa-globe"></i> #' + d3.select(el).attr('data-rank') : '';
  tooltipText += score ? '' : 'n/a';
  tooltipText += "</small></strong>";

  $('#tooltip').append(tooltipText);
}
