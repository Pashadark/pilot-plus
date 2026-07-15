"use client";

import { motion } from "framer-motion";
import {
  FiBell,
  FiChevronDown,
  FiMoon,
  FiSearch,
  FiSun,
  FiUser,
} from "react-icons/fi";


export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="
        h-16
        w-full
        fixed
        top-0
        z-50
        flex
        items-center
        justify-between
        border-b
        border-[#E2E8F0]
        bg-white/80
        backdrop-blur-xl
        px-6
      "
    >

      {/* LEFT */}
      <div className="flex items-center gap-8">

        {/* LOGO */}
        <div className="flex items-center gap-2">

          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              bg-[#0092BE]
              text-white
              font-bold
            "
          >
            P+
          </div>

          <div
            className="
              text-xl
              font-semibold
              tracking-tight
              text-[#0F172A]
            "
          >
            Pilot+
          </div>

        </div>


        {/* SEARCH */}
        <div
          className="
            flex
            h-10
            w-[360px]
            items-center
            gap-3
            rounded-xl
            border
            border-[#E2E8F0]
            bg-[#F8FAFC]
            px-4
            text-[#64748B]
          "
        >

          <FiSearch size={18}/>

          <span className="text-sm">
            Поиск автомобилей, устройств...
          </span>

        </div>

      </div>



      {/* RIGHT */}
      <div className="flex items-center gap-5">


        {/* COMPANY */}
        <button
          className="
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-[#E2E8F0]
            bg-white
            px-4
            py-2
            text-sm
            text-[#0F172A]
          "
        >

          Pilot Demo

          <FiChevronDown size={16}/>

        </button>



        {/* NOTIFICATIONS */}
        <button
          className="
            relative
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            hover:bg-[#F1F5F9]
          "
        >

          <FiBell size={20}/>

          <span
            className="
              absolute
              right-2
              top-2
              h-2
              w-2
              rounded-full
              bg-[#0092BE]
            "
          />

        </button>



        {/* THEME */}
        <button
          className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            hover:bg-[#F1F5F9]
          "
        >

          <FiMoon size={20}/>

        </button>



        {/* USER */}
        <button
          className="
            flex
            items-center
            gap-3
            rounded-xl
            px-2
            py-1
            hover:bg-[#F1F5F9]
          "
        >

          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-full
              bg-[#0092BE]
              text-white
            "
          >
            <FiUser size={18}/>
          </div>


          <div className="text-left">

            <div
              className="
                text-sm
                font-medium
                text-[#0F172A]
              "
            >
              Администратор
            </div>

            <div
              className="
                text-xs
                text-[#64748B]
              "
            >
              admin@pilot.plus
            </div>

          </div>


        </button>


      </div>


    </motion.header>
  );
}