"use client";

import { ReactNode } from "react";

import { Header } from "@/shared/components/header/Header";
import { Sidebar } from "@/shared/components/sidebar/Sidebar";


export function AppLayout({
  children,
}: {
  children: ReactNode;
}) {

  return (

    <div
      className="
        min-h-screen
        bg-[#F8FAFC]
        text-[#0F172A]
      "
    >


      <Header />


      <div className="flex">


        <Sidebar />


        <main
          className="
            flex-1
            ml-[260px]
            pt-16
            min-h-screen
          "
        >

          <div
            className="
              p-8
              max-w-[1600px]
            "
          >

            {children}

          </div>


        </main>


      </div>


    </div>

  );

}