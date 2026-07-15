"use client";


import {
  FiMap,
  FiClock,
  FiLock,
  FiX
} from "react-icons/fi";


export function VehiclePanel({

vehicle,
onClose

}:{

vehicle:any;

onClose:()=>void;

}) {


return (

<div

className="
fixed

right-6

top-24

z-50

w-[360px]

rounded-3xl

border

border-[#E2E8F0]

bg-white

shadow-2xl

p-6

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


<h2
className="
text-xl

font-bold

text-[#0F172A]
"
>

{vehicle.name}

</h2>


<div
className="
mt-1

text-green-600

text-sm
"
>

🟢 Online

</div>


</div>



<button

onClick={onClose}

className="
rounded-lg

p-2

hover:bg-slate-100
"

>

<FiX />

</button>


</div>





<div
className="
mt-6

space-y-4
"
>


<div>

<div className="text-xs text-slate-500">
Скорость
</div>


<div className="text-lg font-semibold">
{vehicle.speed} км/ч
</div>


</div>




<div>

<div className="text-xs text-slate-500">
Топливо
</div>


<div className="text-lg font-semibold">
45%
</div>


</div>




<div>

<div className="text-xs text-slate-500">
Пробег
</div>


<div className="text-lg font-semibold">
125000 км
</div>


</div>




<div>

<div className="text-xs text-slate-500">
Последняя связь
</div>


<div className="text-lg font-semibold">
10 секунд назад
</div>


</div>



</div>






<div
className="
mt-8

grid

grid-cols-3

gap-3
"
>


<button
className="
flex
flex-col
items-center

gap-2

rounded-xl

bg-[#0092BE]/10

p-3

text-[#0092BE]
"
>

<FiMap/>

<span className="text-xs">
Карта
</span>

</button>




<button
className="
flex
flex-col
items-center

gap-2

rounded-xl

bg-slate-100

p-3
"
>

<FiClock/>

<span className="text-xs">
История
</span>

</button>




<button
className="
flex
flex-col
items-center

gap-2

rounded-xl

bg-red-50

p-3

text-red-500
"
>

<FiLock/>

<span className="text-xs">
Блок
</span>

</button>



</div>



</div>


)

}