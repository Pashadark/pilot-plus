"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createRoot,
} from "react-dom/client";


import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";


import { VehicleMarker } from "./VehicleMarker";

import { VehiclePanel } from "./VehiclePanel";



const vehicles = [

{
  name:"Haval Jolion",
  plate:"А123ВС777",
  speed:65,
  status:"moving" as const,
  lng:37.6173,
  lat:55.7558,
},


{
  name:"Geely Atlas",
  plate:"М456ОР799",
  speed:0,
  status:"idle" as const,
  lng:37.67,
  lat:55.76,
},


{
  name:"Kia K5",
  plate:"Т789КХ197",
  speed:42,
  status:"online" as const,
  lng:37.58,
  lat:55.74,
},


];



type VehicleStatus =
"online"
|
"moving"
|
"idle"
|
"alarm";




export function FleetMap(){


const mapContainer =
useRef<HTMLDivElement|null>(null);



const mapRef =
useRef<maplibregl.Map|null>(null);



const markerRoots =
useRef<any[]>([]);



const [selectedVehicle,setSelectedVehicle] =
useState<any>(null);





useEffect(()=>{


if(!mapContainer.current)
return;



if(mapRef.current)
return;





const map =
new maplibregl.Map({


container:
mapContainer.current,



style:
{

version:8,


sources:{


osm:{


type:"raster",


tiles:[

"https://tile.openstreetmap.org/{z}/{x}/{y}.png"

],


tileSize:256,


}

},



layers:[


{

id:"osm",

type:"raster",

source:"osm",

}


]


},



center:[

37.6173,

55.7558

],



zoom:10,



attributionControl:false,


});





mapRef.current=map;



map.addControl(

new maplibregl.NavigationControl(),

"top-right"

);







vehicles.forEach((vehicle,index)=>{



const element =
document.createElement("div");



element.style.zIndex="10";



const root =
createRoot(element);



markerRoots.current[index]=root;




root.render(

<VehicleMarker


name={vehicle.name}


plate={vehicle.plate}


speed={vehicle.speed}


status={
vehicle.status
}


expanded={false}


/>

);






element.onclick=()=>{


setSelectedVehicle(vehicle);



map.flyTo({


center:[

vehicle.lng,

vehicle.lat

],


zoom:14,


duration:800,


});


};






new maplibregl.Marker({

element,

anchor:"bottom"

})


.setLngLat([

vehicle.lng,

vehicle.lat

])


.addTo(map);



});






function updateZoom(){


const expanded =
map.getZoom()>12;



vehicles.forEach((vehicle,index)=>{


markerRoots.current[index].render(


<VehicleMarker


name={vehicle.name}


plate={vehicle.plate}


speed={vehicle.speed}


status={
vehicle.status
}


expanded={expanded}


/>


);


});


}




map.on(
"zoom",
updateZoom
);





return ()=>{


map.remove();


mapRef.current=null;


};


},[]);







return (


<div

className="
relative
h-full
w-full
"

>


<div

ref={mapContainer}

className="
absolute
inset-0
h-full
w-full
"

/>





{
selectedVehicle &&


<VehiclePanel


vehicle={selectedVehicle}


onClose={()=>{

setSelectedVehicle(null);

}}


/>

}



</div>


);


}