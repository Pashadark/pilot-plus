"use client";

import { motion } from "framer-motion";
import type { IconType } from "react-icons";


export function StatCard({
title,
value,
change,
icon:Icon,
}:{
title:string;
value:string;
change:string;
icon:IconType;
}){


return (

<motion.div

initial={{
opacity:0,
y:20
}}

animate={{
opacity:1,
y:0
}}

whileHover={{
y:-5
}}

className="
rounded-2xl
border
border-[#E2E8F0]

bg-white

p-5

shadow-sm

transition

"

>


<div
className="
flex
items-start
justify-between
"
>


<div>


<div
className="
text-sm
text-[#64748B]
"
>
{title}
</div>


<div
className="
mt-3

text-4xl

font-bold

text-[#0F172A]
"
>
{value}
</div>


<div
className="
mt-2

text-xs

text-[#0092BE]
"
>
{change}
</div>


</div>


<div
className="
flex
h-12
w-12

items-center
justify-center

rounded-xl

bg-[#0092BE]/10

text-[#0092BE]
"
>

<Icon size={24}/>

</div>


</div>


</motion.div>

)

}
