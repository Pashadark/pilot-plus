"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";


export function Card({
children,
className=""
}:{
children:ReactNode;
className?:string;
}){


return (

<motion.div

initial={{
opacity:0,
y:15
}}

animate={{
opacity:1,
y:0
}}

transition={{
duration:0.3
}}

className={`
rounded-2xl
border
border-[#E2E8F0]
bg-white
shadow-sm
${className}
`}

>

{children}

</motion.div>

);


}