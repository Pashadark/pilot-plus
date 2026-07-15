"use client";

import { AppLayout } from "@/shared/layouts/AppLayout";

import { FleetMap } from "@/shared/components/map/FleetMap";

import {
  FiTruck,
  FiWifi,
  FiAlertTriangle,
  FiTool,
} from "react-icons/fi";

import { StatCard } from "@/shared/components/dashboard/StatCard";


const stats = [
  {
    title: "Всего автомобилей",
    value: "245",
    icon: FiTruck,
    change: "+12 сегодня",
  },
  {
    title: "Онлайн",
    value: "231",
    icon: FiWifi,
    change: "94%",
  },
  {
    title: "Нет связи",
    value: "5",
    icon: FiAlertTriangle,
    change: "Требует внимания",
  },
  {
    title: "Требуется ТО",
    value: "9",
    icon: FiTool,
    change: "Запланировано",
  },
];


export default function Home() {

  return (

    <AppLayout>

      <div>


        <h1
          className="
          text-3xl
          font-bold
          text-[#0F172A]
          "
        >
          Центр управления транспортом
        </h1>


        <p
          className="
          mt-2
          text-[#64748B]
          "
        >
          Мониторинг автопарка в реальном времени
        </p>




        {/* STAT CARDS */}

        <div
          className="
          mt-8
          grid
          grid-cols-4
          gap-5
          "
        >

          {
            stats.map((item)=>(

              <StatCard

                key={item.title}

                title={item.title}

                value={item.value}

                change={item.change}

                icon={item.icon}

              />

            ))
          }

        </div>





        {/* MAP */}

        <div
          className="
          mt-8
          h-[520px]
          overflow-hidden
          rounded-3xl
          border
          border-[#1E293B]
          shadow-xl
          "
        >

          <FleetMap />

        </div>







        {/* BOTTOM PANELS */}


        <div
          className="
          mt-8
          grid
          grid-cols-2
          gap-6
          "
        >



          {/* EVENTS */}

          <div
            className="
            rounded-2xl
            border
            border-[#E2E8F0]
            bg-white
            p-6
            "
          >

            <h2
              className="
              text-lg
              font-semibold
              text-[#0F172A]
              "
            >
              Последние события
            </h2>


            <div
              className="
              mt-5
              space-y-5
              "
            >


              <div className="flex gap-3">

                <span>
                  🚨
                </span>

                <div>

                  <div className="font-medium">
                    Автомобиль покинул геозону
                  </div>

                  <div className="text-sm text-[#64748B]">
                    Haval Jolion • 2 минуты назад
                  </div>

                </div>

              </div>



              <div className="flex gap-3">

                <span>
                  ⚠️
                </span>

                <div>

                  <div className="font-medium">
                    Нет связи
                  </div>

                  <div className="text-sm text-[#64748B]">
                    Geely Atlas
                  </div>

                </div>

              </div>



              <div className="flex gap-3">

                <span>
                  🔧
                </span>

                <div>

                  <div className="font-medium">
                    Требуется обслуживание
                  </div>

                  <div className="text-sm text-[#64748B]">
                    Kia K5
                  </div>

                </div>

              </div>


            </div>


          </div>





          {/* VEHICLE STATUS */}


          <div
            className="
            rounded-2xl
            border
            border-[#E2E8F0]
            bg-white
            p-6
            "
          >


            <h2
              className="
              text-lg
              font-semibold
              text-[#0F172A]
              "
            >
              Статус транспорта
            </h2>



            <div
              className="
              mt-5
              space-y-5
              "
            >


              <div className="flex justify-between">

                <span>
                  🚗 Haval Jolion
                </span>

                <span className="text-green-600">
                  ● Online
                </span>

              </div>



              <div className="flex justify-between">

                <span>
                  🚙 Geely Atlas
                </span>

                <span className="text-yellow-600">
                  ● Стоит
                </span>

              </div>



              <div className="flex justify-between">

                <span>
                  🚘 Kia K5
                </span>

                <span className="text-blue-600">
                  ● Движется
                </span>

              </div>



            </div>


          </div>



        </div>



      </div>


    </AppLayout>

  );

}