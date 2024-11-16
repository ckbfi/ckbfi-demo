"use client";

import React, { useState, useEffect } from "react";
import { TextInput } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "../../../utils";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";
import { udtBalanceFrom } from "@ckb-ccc/connector-react";

const TOTAL_XUDT_SUPPLY = BigInt(800_000_000) * BigInt(100_000_000);

function getPrice(currentXudtAmount:bigint, xudtAmount:bigint) {
    console.log("currentXudtAmount", currentXudtAmount);
    console.log("xudtAmount", xudtAmount);
    currentXudtAmount = currentXudtAmount / BigInt(100_000_000);
    xudtAmount = xudtAmount / BigInt(100_000_000);
    const dg = BigInt(131500000000000)
    const uint128_400_000_000 = BigInt(100000000);
    const uint128_1 = BigInt(1);
    const uint128_2 = BigInt(2);

    const sum1 = (currentXudtAmount + uint128_400_000_000 - uint128_1) *
                 (currentXudtAmount + uint128_400_000_000) / dg *
                 (uint128_2 * (currentXudtAmount + uint128_400_000_000) - uint128_1);
    const sum2 = (currentXudtAmount + uint128_400_000_000 + xudtAmount - uint128_1) *
                 (currentXudtAmount + uint128_400_000_000 + xudtAmount)/ dg *
                 (uint128_2 * (currentXudtAmount + uint128_400_000_000) + uint128_2 * xudtAmount - uint128_1);
    console.log("sum1", sum1);
    console.log("sum2", sum2);
    const summation = sum2 - sum1;
    return summation;
}

function getBuyPriceAfterFee(currentXudtAmount:bigint, xudtAmount:bigint) {
    const price = getPrice(currentXudtAmount, xudtAmount);
    const fee = price * BigInt(500) / BigInt(10_000);
    return price + fee;
}

function getSellPriceAfterFee(currentXudtAmount:bigint, xudtAmount:bigint) {
    const price = getPrice(currentXudtAmount-xudtAmount,xudtAmount );
    const fee = price * BigInt(500) / BigInt(10_000);
    return price - fee;
}

export default function TransferXUdt() {
  const { signer, createSender } = useApp();
  const { log } = createSender("bonding-curve trade xUDT");

  const { explorerTransaction } = useGetExplorerLink();

  const [buyXudtAmount, setBuyXudtAmount] = useState("");
  const [sellXudtAmount, setSellXudtAmount] = useState("");
  const [estimatedCkb, setEstimatedCkb] = useState("");
  const [estimatedCkbForSell, setEstimatedCkbForSell] = useState("");
  const type_args = "0xf797c2badc75a1e604787c715f045f8a851fa811394ce2f23c501098f3f8bfce";
  const boundingsLock = new ccc.Script("0x6bf85c3ae774fb56a2b3708d147b3f742f82596fe127033c2bde577c633e2227", "type", type_args);

  const CellDepsTxHash = "0x2f426d10aeb75a02fe3ec22a084285b8b5d3a875d556c6edfc2ab9b9a003367b"
  //const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x756defe0217d1ba946cf67966498ec8d72cfe227632d3c3226dc38ee9ae4ee3d");
  // 将type一开始就定义好，构造异步函数，然后在useEffect中调用
  

  useEffect(() => {
    const calculateEstimatedCkb = async () => {
      if (buyXudtAmount === "") {
        setEstimatedCkb("");
        return;
      }
      const buyAmount = ccc.fixedPointFrom(buyXudtAmount);
      let poolXudtAmount = BigInt(0);

      if (!signer) {
        return;
      }
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, type_args);

      const poolCells = [];
      const boundingsCell = signer.client.findCellsOnChain({
        script: boundingsLock,
        scriptType: "lock",
        scriptSearchMode: "exact",
      });

      for await (const cell of boundingsCell) {
        poolCells.push(cell);
        if (cell.cellOutput.type?.args === type.args) {
          poolXudtAmount += udtBalanceFrom(cell.outputData);
        }
      }

      const shouldPayCkbAmount = getBuyPriceAfterFee(TOTAL_XUDT_SUPPLY - poolXudtAmount, buyAmount);
      console.log("shouldPayCkbAmount", shouldPayCkbAmount);
      setEstimatedCkb(ccc.fixedPointToString(shouldPayCkbAmount, 8));
    };

    calculateEstimatedCkb();
  }, [buyXudtAmount, signer]);

  useEffect(() => {
    const calculateEstimatedCkbForSell = async () => {
      if (sellXudtAmount === "") {
        setEstimatedCkbForSell("");
        return;
      }
      const sellAmount = ccc.fixedPointFrom(sellXudtAmount);
      let poolXudtAmount = BigInt(0);

      
      if (!signer) {
        return;
      }
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, type_args);

      const poolCells = [];
      const boundingsCell = signer.client.findCellsOnChain({
        script: boundingsLock,
        scriptType: "lock",
        scriptSearchMode: "exact",
      });

      for await (const cell of boundingsCell) {
        poolCells.push(cell);
        if (cell.cellOutput.type?.args === type.args) {
          poolXudtAmount += udtBalanceFrom(cell.outputData);
        }
      }
      console.log("poolXudtAmount", poolXudtAmount);
      
      const canGetCkbAmount = getSellPriceAfterFee(TOTAL_XUDT_SUPPLY - poolXudtAmount, sellAmount);
      console.log("canGetCkbAmount", canGetCkbAmount);
      setEstimatedCkbForSell(ccc.fixedPointToString(canGetCkbAmount, 8));
    };

    calculateEstimatedCkbForSell();
  }, [sellXudtAmount, signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Buy BCTK"
        placeholder="Amount of xUDT to buy"
        state={[buyXudtAmount, setBuyXudtAmount]}
      />
      <div className="mt-2">
        <span>Estimated CKB to Pay: {estimatedCkb}</span>
      </div>
      <TextInput
        label="Sell BCTK"
        placeholder="Amount of xUDT to sell"
        state={[sellXudtAmount, setSellXudtAmount]}
      />
      <div className="mt-2">
        <span>Estimated CKB to Receive: {estimatedCkbForSell}</span>
      </div>
      <ButtonsPanel>
        <Button
          className="self-center"
          onClick={async () => {
            if (!signer || buyXudtAmount === "") {
              return;
            }
            const receiver = await signer.getRecommendedAddress() 
            const { script: lock } = await ccc.Address.fromString(
                receiver,
                signer.client,
              );
            const buyAmount = ccc.fixedPointFrom(buyXudtAmount);
            let poolXudtAmount = BigInt(0);
            let poolXudtCell:ccc.Cell | undefined;
            const poolCells = [];
            const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, type_args);

            const boundingsCell =signer.client.findCellsOnChain({
              script: boundingsLock,
              scriptType: "lock",
              scriptSearchMode: "exact",
            });

            for await (const cell of boundingsCell) {
              console.log("cell", cell);
              poolCells.push(cell);
              if (cell.cellOutput.type?.args === type.args) {
                poolXudtAmount += udtBalanceFrom(cell.outputData);
                poolXudtCell = cell;
              }
            }

            const shouldPayCkbAmount = getBuyPriceAfterFee(TOTAL_XUDT_SUPPLY - poolXudtAmount, buyAmount);
            let poolCkbCell;
            for (const cell of poolCells) {
              if (cell.cellOutput.type == undefined) {
                poolCkbCell = cell;
              }
            }
            let tx: ccc.Transaction;
            if (poolCkbCell){
              tx = ccc.Transaction.from({
                inputs: [new ccc.CellInput(poolXudtCell!.outPoint, BigInt(0)), new ccc.CellInput(poolCkbCell!.outPoint, BigInt(0))],
                outputs: [
                  {  lock: boundingsLock, type },
                  { capacity: poolCkbCell!.cellOutput.capacity + shouldPayCkbAmount, lock: boundingsLock },
                  { capacity: ccc.fixedPointFrom(144), lock, type },
                ],
                outputsData: [
                  ccc.numLeToBytes(udtBalanceFrom(poolXudtCell!.outputData) - buyAmount, 16),
                  "0x",
                  ccc.numLeToBytes(buyAmount, 16),
                ]
              });
            }else {
              tx = ccc.Transaction.from({
                inputs: [new ccc.CellInput(poolXudtCell!.outPoint, BigInt(0))],
                outputs: [
                  { lock: boundingsLock, type },
                  { capacity: shouldPayCkbAmount + BigInt(100*100000000), lock: boundingsLock },
                  { capacity: ccc.fixedPointFrom(144), lock, type },
                ],
                outputsData: [
                  ccc.numLeToBytes(udtBalanceFrom(poolXudtCell!.outputData) - buyAmount, 16),
                  "0x",
                  ccc.numLeToBytes(buyAmount, 16),
                ]
              });
            }

            

            await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
            tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(CellDepsTxHash, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
            await tx.completeInputsByUdt(signer, type);
            await tx.completeFeeBy(signer, 1000);
            const distributeTxHash = await signer.sendTransaction(tx);
            log("Transaction sent:", explorerTransaction(distributeTxHash));
          }}
        >
          Buy
        </Button>
        <Button
          className="self-center"
          onClick={async () => {
            if (!signer || sellXudtAmount === "") {
              return;
            }
            const receiver = await signer.getRecommendedAddress() 
            const { script: lock } = await ccc.Address.fromString(
                receiver,
                signer.client,
              );
            const sellAmount = ccc.fixedPointFrom(sellXudtAmount);
            let poolXudtAmount = BigInt(0);
            let poolXudtCell:ccc.Cell | undefined;
            const poolCells = [];
            const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, type_args);

            const boundingsCell = signer.client.findCellsOnChain({
              script: boundingsLock,
              scriptType: "lock",
              scriptSearchMode: "exact",
            });

            for await (const cell of boundingsCell) {
              poolCells.push(cell);
              if (cell.cellOutput.type?.args === type.args) {
                poolXudtAmount += udtBalanceFrom(cell.outputData);
                poolXudtCell = cell;
              }
            }

            const canGetCkbAmount = getSellPriceAfterFee(TOTAL_XUDT_SUPPLY - poolXudtAmount, sellAmount);
            // if (canGetCkbAmount < ccc.fixedPointFrom(64)) {
            //   error("can not sell less than 64 CKB");
            //   return;
            // }
            let poolCkbCell;
            for (const cell of poolCells) {
              if (cell.cellOutput.capacity > canGetCkbAmount && cell.cellOutput.type == undefined) {
                poolCkbCell = cell;
              }
            }

            const tx = ccc.Transaction.from({
              inputs: [
                new ccc.CellInput(poolXudtCell!.outPoint, BigInt(0)),
                new ccc.CellInput(poolCkbCell!.outPoint, BigInt(0)),
              ],
              outputs: [
                { capacity: ccc.fixedPointFrom(154), lock: boundingsLock, type },
                { capacity: poolCkbCell!.cellOutput.capacity - canGetCkbAmount, lock: boundingsLock },
                { capacity: canGetCkbAmount + ccc.fixedPointFrom(144), lock },
              ],
              outputsData: [
                ccc.numLeToBytes(udtBalanceFrom(poolXudtCell!.outputData) + sellAmount, 16),
              ]
            });

            await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
            tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(CellDepsTxHash, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
            await tx.completeInputsByUdt(signer, type);
            const balanceDiff =
                (await tx.getInputsUdtBalance(signer.client, type)) -
                tx.getOutputsUdtBalance(type);
              const myInputXudtAmount = await tx.getInputsUdtBalance(signer.client, type)
              console.log("myInputXudtAmount",myInputXudtAmount);
              console.log("balanceDiff",balanceDiff);
              if (balanceDiff > ccc.Zero) {
                // Add UDT change
                tx.addOutput(
                  {
                    lock,
                    type,
                  },
                  ccc.numLeToBytes(balanceDiff, 16),
                );
              }
            // Complete missing parts: Fill inputs
            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer, 1000);
            console.log("tx", tx);
            const distributeTxHash = await signer.sendTransaction(tx);
            log("Transaction sent:", explorerTransaction(distributeTxHash));
          }}
        >
          Sell
        </Button>
      </ButtonsPanel>
    </div>
  );
}
