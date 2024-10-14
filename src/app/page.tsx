/* eslint-disable @next/next/no-img-element */
"use client";

import { ccc } from "@ckb-ccc/connector-react";
import React, { useEffect } from "react";
import { BigButton } from "./components/BigButton";
import { useRouter } from "next/navigation";
import { useApp } from "./context";

export default function Home() {
  const router = useRouter();
  const { signer } = useApp();

  useEffect(() => {
    if (signer) {
      router.push("/connected");
    }
  }, [signer, router]);

  useEffect(() => {
    router.prefetch("/connectPrivateKey");
  }, [router]);

  // 打开链接钱包的弹窗
  const { open } = ccc.useCcc();

  return (
    <>
      <div className="my-4 flex grow flex-col items-center justify-center gap-8 md:flex-row md:gap-32">
        <BigButton onClick={open} iconName="Wallet" className="text-cyan-500">
          Wallet
        </BigButton>
      </div>
    </>
  );
}
