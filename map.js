var query_type = "pokemon"
var apigClient = apigClientFactory.newClient();
var last_update = 0;
var update_mark = false;

var map_manager = {
    map_items : [],
}

var now_time = undefined;
function refresh_now_time() {
    now_time = new Date().getTime() / 1000;
}
refresh_now_time();

function set_user_current_location() {
    // Change initial view if possible
    if (navigator.geolocation) {
      function set_initial_view(position) {
        map_manager.map.setView({
            center: new Microsoft.Maps.Location(position.coords.latitude, position.coords.longitude),
        });
      }
      navigator.geolocation.getCurrentPosition(set_initial_view);
    }
}

// Initializa map DOM
function loadMapScenario() {
    // init map
    map_manager.map = new Microsoft.Maps.Map(document.getElementById('pokemonmap'), {
        credentials: 'AjDchhYNn7_bhP8UG8iRnhGEk3gq4wl7hxkORwk3eJa9HWFONQERXGMglVEQ0pPw',
        enableClickableLogo: false,
        enableSearchLogo: false,
        showDashboard: false,
        tileBuffer: 4,
        useInertia: false,
        showMapTypeSelector: false,
    });
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|BB|PlayBook|IEMobile|Windows Phone|Kindle|Silk|Opera Mini/i.test(navigator.userAgent)) {
        map_manager.map.setView({
            // Use time square as starting point.
            center: new Microsoft.Maps.Location(40.7553085,-73.9844294),
            zoom: 17
        });
    }
    else {
        map_manager.map.setView({
            // Use time square as starting point.
            center: new Microsoft.Maps.Location(40.7553085,-73.9844294),
            zoom: 15
        });
    }

    set_user_current_location();

    // Every time user view changed, update the map
    Microsoft.Maps.Events.addHandler(map_manager.map, 'viewchangeend', update_map);
}


function get_expire_time_from_epoch(epoch) {
    var diff = (epoch / 1000) - now_time;
    var second = Math.floor(diff % 60);
    var minute = Math.floor(diff / 60);
    if (second < 10) {
      second = "0" + second;
    }
    return minute + ":" + second;
}

function get_pushpin_from_map_item(map_item) {
    try {
        var icon_url = undefined;
        var title = "";

        // pokemon logic
        if (map_item['pokemon_id'] !== undefined) {
            if (map_item['expire'] <= now_time * 1000) {
                // already expired, skip it
                return null;
            }
            icon_url = 'https://s3-us-west-2.amazonaws.com/pokemon-map/icons/pokemon/' + map_item['pokemon_id'] + '.png';
            title = get_expire_time_from_epoch(map_item['expire'])
        }
        // gym logic
        else if (map_item["gymteam"] !== undefined) {
            icon_url = 'https://s3-us-west-2.amazonaws.com/pokemon-map/icons/pharmacy-icon' + map_item["gymteam"] + '.png';
        }
        // pokestop logic
        else if (map_item['lure'] > now_time * 1000) {
            icon_url = 'https://s3-us-west-2.amazonaws.com/pokemon-map/icons/pokeball_lure.png';
            title = get_expire_time_from_epoch(map_item['lure'])
        }
        else {
             icon_url = 'https://s3-us-west-2.amazonaws.com/pokemon-map/icons/pokeball.png';
        }

        var pushpin = new Microsoft.Maps.Pushpin(
                    new Microsoft.Maps.Location(map_item["latitude"], map_item["longitude"]), 
                    { icon: icon_url,
                      title: title,
                      anchor: new Microsoft.Maps.Point(0, 0) });
        return pushpin
    }
    catch(err) {
        return null;
    }
}

// Update expiation time, pick up new pokemon if they are available
function reload_map_items() {
    refresh_now_time();

    var layer = new Microsoft.Maps.Layer();

    item_list = map_manager.map_items;
    for (i = 0; i < item_list.length; i++) { 
        var item = item_list[i];
        var pushpin = get_pushpin_from_map_item(item)
        if (pushpin !== null ){
            layer.add(pushpin)
        }
    }
    // Update map with latest pins
    map_manager.map.layers.clear();
    map_manager.map.layers.insert(layer);
}

// Update new map items
function update_map() {
    refresh_now_time()
    // Can not trigger this more than one time
    if ((now_time - last_update < 1) || (update_mark === true)) {
        return;
    }
    last_update = now_time
    update_mark = true

    // Get current rectangular
    bounds = map_manager.map.getBounds();
    northWest = bounds.getNorthwest();
    southEast = bounds.getSoutheast();
    // Rounding 4 digit, after 4 digit, difference is small on map
    // This will help cdn caching
    var params = {
        west: Math.floor(northWest.longitude * 10000) / 10000,
        east: Math.ceil(southEast.longitude * 10000) / 10000,
        north: Math.ceil(northWest.latitude * 10000) / 10000,
        south: Math.floor(southEast.latitude * 10000) / 10000,
    };

    if (query_type == "pokemon") {
        apigClient.pokemonGet(params, {}, {})
            .then(function(result){
                update_mark = false
                map_manager.map_items = result.data;
                reload_map_items();
            }).catch( function(result){
                update_mark = false
            });
    }
    if (query_type == "pokestop") {
        apigClient.pokestopGet(params, {}, {})
            .then(function(result){
                update_mark = false
                map_manager.map_items = result.data;
                reload_map_items();
            }).catch( function(result){
                update_mark = false
            });
    }
    if (query_type == "gym") {
        apigClient.gymGet(params, {}, {})
            .then(function(result){
                update_mark = false
                map_manager.map_items = result.data;
                reload_map_items();
            }).catch( function(result){
                update_mark = false
            });
    }
}

function close_drawer_if_open() {
    if (document.querySelector('.mdl-layout__obfuscator').classList.contains('is-visible')) {
        var layout = document.querySelector('.mdl-layout');
        layout.MaterialLayout.toggleDrawer();
    }
}

function query_type_changed() {
    map_manager.map_items =[];
    reload_map_items();
    update_map();
    close_drawer_if_open();
}


function query_pokemon() {
    query_type = "pokemon";
    document.getElementById('home_title').innerHTML="Pokemon Map"
    console.log("Switch to query pokemon");
    query_type_changed();
}
function query_pokestop() {
    query_type= "pokestop"
    document.getElementById('home_title').innerHTML="Pokestop Map"
    console.log("Switch to query pokestop");
    query_type_changed();
}
function query_gym() {
    query_type= "gym"
    document.getElementById('home_title').innerHTML="Pokemon Gym Map"
    console.log("Switch to query gym");
    query_type_changed();
}


function toggle_faq_list() {
    for( var i = 1; i <= 6; i++) {
        var faq_card = document.getElementById('faq' + i);
        if (faq_card.style.display == "") {
            faq_card.style.display = "inline"
        }
        else {
            faq_card.style.display = ""
        }
    }
    close_drawer_if_open();
}



// Refresh expire time every second
window.setInterval(reload_map_items, 1000)

// Query new pokemon every 10 seconds
window.setInterval(update_map, 10000)


