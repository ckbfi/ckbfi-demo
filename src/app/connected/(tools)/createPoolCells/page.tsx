"use client";

import React, { useState } from "react";
import { TextInput } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "../../../utils";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";



export default function CreateCkbfiPoolCells() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("ckbfi create pool cells");

  const { explorerTransaction } = useGetExplorerLink();

  const [xudtArgs, setXudtArgs] = useState("");
  const [bondingsCurveCodeHash, setBondingsCurveCodeHash] = useState("0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606");
  const [uniqueLiquidityCodeHash, setUniqueLiquidityCodeHash] = useState("0xad5ac9fe1d3cdbe57301be89373ba6f4f154c8af47cfb0c34515758f3e22af5e");
  const [uniqueLiquidityDepTxHash, setUniqueLiquidityDepTxHash] = useState("0x1e3a086fc28b9726b1c8fc9c462bd0f7a3f0f5600e263dab84570fa4077af682");
  const [xudtCellTxHash, setXudtCellTxHash] = useState("");
  const [xudtCellIndex, setXudtCellIndex] = useState("0");
  // setXudtArgs("0x431c4a68c1f4d1344b3dd3d1d3e46f768e45b76212f9042d17fb1d007850ab0f");
  // setBondingsCurveCodeHash("0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606");
  // setTypeId("0x2f0d477394f7b617e264bed54368a12a8b36833d399b74616bfc258490181be8");
  // setOrderCodeHash("0xeca2d82fe00581883c038f00eb5b8f8b79f21e4f4a9c52cd952d50f1f4afc765");




  // const CellDepsTxHash = "0xd6a1ba4b8e43384e490615715b768883c1e5f28b2f54d501eb62272d0011879d"
  //const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x756defe0217d1ba946cf67966498ec8d72cfe227632d3c3226dc38ee9ae4ee3d");
  // 将type一开始就定义好，构造异步函数，然后在useEffect中调用




  return (
    <div className="flex w-full flex-col items-stretch">
      <div className="mt-2">
        <span>Base Info</span>
      </div>
      <TextInput
        label="Enter xUDT Cell Tx Hash"
        placeholder="0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606"
        state={[xudtCellTxHash, setXudtCellTxHash]}
      />
      <TextInput
        label="Enter xUDT Cell Index"
        placeholder="0"
        state={[xudtCellIndex, setXudtCellIndex]}
      />
      <TextInput
        label="Enter xUDT Args"
        placeholder="xUDT Args"
        state={[xudtArgs, setXudtArgs]}
      />
      <TextInput
        label="Enter bondingsCurveCodeHash"
        placeholder="bondingsCurveCodeHash"
        state={[bondingsCurveCodeHash, setBondingsCurveCodeHash]}
      />
      <TextInput
        label="Enter uniqueLiquidityCodeHash"
        placeholder="uniqueLiquidityCodeHash"
        state={[uniqueLiquidityCodeHash, setUniqueLiquidityCodeHash]}
      />
      <TextInput
        label="Enter uniqueLiquiditDepTxHash"
        placeholder="uniqueLiquiditDepTxHash"
        state={[uniqueLiquidityDepTxHash, setUniqueLiquidityDepTxHash]}
      />
      <ButtonsPanel>
        <Button
          className="self-center"
          onClick={async () => {
            if (!signer || xudtArgs === "" || bondingsCurveCodeHash === "" || uniqueLiquidityCodeHash === "" || uniqueLiquidityDepTxHash === "" || xudtCellTxHash === "" || xudtCellIndex === "") {
              error("Please fill in all fields");
              return;
            }
            const receiver = await signer.getRecommendedAddress()
            const { script: lock } = await ccc.Address.fromString(
              receiver,
              signer.client,
            );
            const preBondingsArgs = xudtArgs + '00'.repeat(32)
            const preBondingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", preBondingsArgs as ccc.Hex);
            const preTypeIdLock = new ccc.Script(uniqueLiquidityCodeHash as ccc.Hex, "type", "0x" + "00".repeat(64) as ccc.Hex)
            const xudtTypeScript = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, xudtArgs);

            const createPoolTx = ccc.Transaction.from({
              inputs: [
                new ccc.CellInput(new ccc.OutPoint(xudtCellTxHash as ccc.Hex, BigInt(xudtCellIndex)), BigInt(0)),
              ],
              outputs: [
                // pool xudt cell
                { lock: preBondingsLock, type: xudtTypeScript },
                // pool ckb cell
                { lock: preBondingsLock },
                // unique liquidity manager cell
                { lock: preTypeIdLock, type: preTypeIdLock },
                // charge xudt cell
                { lock, type: xudtTypeScript },
              ],
              outputsData: [
                ccc.numLeToBytes(BigInt(931) * BigInt(1_000_000) * BigInt(100_000_000), 16),
                "0x",
                "0x" + "00".repeat(32),
                ccc.numLeToBytes(BigInt(69) * BigInt(1_000_000) * BigInt(100_000_000), 16),
              ]
            });
            await createPoolTx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.XUdt,
            );
            createPoolTx.addCellDeps({
              outPoint: {
                txHash: uniqueLiquidityDepTxHash,
                index: 0,
              },
              depType: "code",
            });
            await createPoolTx.completeFeeBy(signer, 1000);
            // 更新typeId
            const outpointTypeId = ccc.hashTypeId(createPoolTx.inputs[0], 2)

            // 更新unique cell的script xudt_args(32) | type id(32)
            if (createPoolTx.outputs[2].type) {
              createPoolTx.outputs[2].type.args = xudtArgs + outpointTypeId.slice(2) as ccc.Hex;
              createPoolTx.outputs[2].lock = createPoolTx.outputs[2].type;
            }
            // 更新BondingsArgs（xudt_args+typeid）
            const bondingsArgs = xudtArgs + outpointTypeId.slice(2)
            createPoolTx.outputs[0].lock.args = bondingsArgs as ccc.Hex;
            createPoolTx.outputs[1].lock.args = bondingsArgs as ccc.Hex;
            console.log(`outpointTypeId:${outpointTypeId}`)
            // 更新unique cell data
            const xudtLiquididtyData = ccc.numLeToBytes(BigInt(931) * BigInt(1_000_000), 16);
            const ckbLiquididtyData = ccc.numLeToBytes(createPoolTx.outputs[1].capacity, 16);
            const concatenatedBytes = new Uint8Array(xudtLiquididtyData.length + ckbLiquididtyData.length);
            concatenatedBytes.set(xudtLiquididtyData, 0);
            concatenatedBytes.set(ckbLiquididtyData, xudtLiquididtyData.length);
            createPoolTx.outputsData[2] = '0x' + Buffer.from(concatenatedBytes).toString('hex') as ccc.Hex;
            console.log("type id data:", createPoolTx.outputsData[2])
            console.log("createPoolTx", createPoolTx);
            try {
              const createPoolTxHash = await signer.sendTransaction(createPoolTx);
              log("Transaction sent:", explorerTransaction(createPoolTxHash));
              log("outpointTypeId", outpointTypeId);
            } catch (e) {
              const errStr = String(e);
              console.log("e", errStr);
              if (errStr.includes("Insufficient CKB")) {
                // 请等待上一个交易完成或检查余额是否足够
                error("please wait for the previous transaction to complete or check if the balance is sufficient\n" + errStr);
              } else {
                error("errStr");
              }
            }

          }}
        >
          Create pool
        </Button>
      </ButtonsPanel>
    </div>
  );
}
