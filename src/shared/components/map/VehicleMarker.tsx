"use client";

import { motion } from "framer-motion";


type Status =
  | "online"
  | "moving"
  | "idle"
  | "alarm";


interface Props {
  name: string;
  plate: string;
  speed: number;
  status: Status;
  expanded: boolean;
}


export function VehicleMarker({
  name,
  plate,
  speed,
  status,
  expanded,
}: Props) {


const statusConfig = {

  online:{
    text:"Заправляется",
    color:"#22c55e"
  },

  moving:{
    text:"Едет",
    color:"#0092BE"
  },

  idle:{
    text:"Стоит",
    color:"#eab308"
  },

  alarm:{
    text:"Тревога",
    color:"#ef4444"
  }

};



const current =
statusConfig[status];



return (

<motion.div

initial={{
scale:0
}}

animate={{
scale:1
}}

transition={{
duration:0.2
}}

className="
relative
cursor-pointer
"

>


<div

className="
flex
h-12
w-12

items-center
justify-center

rounded-full

bg-white

border-2

shadow-xl

text-xl

"

style={{
borderColor:current.color
}}

>

🚗


<div

className="
absolute
right-0
bottom-0

h-3
w-3

rounded-full

border-2

border-white

"

style={{
backgroundColor:current.color
}}

/>


</div>



{
expanded &&

<motion.div

initial={{
opacity:0,
y:10
}}

animate={{
opacity:1,
y:0
}}

className="
absolute
top-14
left-1/2
-translate-x-1/2

z-50

min-w-[180px]

rounded-xl

border

border-[#E2E8F0]

bg-white

p-3

shadow-2xl

text-xs

"

>


<div
className="
font-semibold
text-[#0F172A]
"
>

{name}

</div>



<div

className="
mt-1

inline-block

rounded-md

border

bg-[#F8FAFC]

px-2

py-1

font-mono

font-bold

"

>

{plate}

</div>




<div
className="
mt-2
text-[#64748B]
"
>

{speed} км/ч

</div>



<div

className="
mt-1
font-medium
"

style={{
color:current.color
}}

>

● {current.text}

</div>



</motion.div>

}


</motion.div>

);

}