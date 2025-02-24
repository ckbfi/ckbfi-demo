"use client";

import React, { useState, useEffect } from "react";
import { TextInput } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "../../../utils";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";
import { udtBalanceFrom } from "@ckb-ccc/connector-react";
import { constructArgs,findAmount,getBuyPriceAfterFee,getSellPriceAfterFee,TOTAL_XUDT_SUPPLY,XUDT_LAUNCH_AMOUNT,parseArgs } from '../../../utils'



export default function CreateCkbfiOrderCell() {
  const { signer, createSender } = useApp();
  const { log } = createSender("ckbfi create order cell");

  const { explorerTransaction } = useGetExplorerLink();

  const [buyXudtAmount, setBuyXudtAmount] = useState("");
  const [sellXudtAmount, setSellXudtAmount] = useState("");
  const [estimatedCkb, setEstimatedCkb] = useState("");
  const [estimatedCkbForSell, setEstimatedCkbForSell] = useState("");
  const [ckbAmount, setCkbAmount] = useState(""); // 新增的CKB输入框状态
  const [xudtArgs, setXudtArgs] = useState("");
  const [bondingsCurveCodeHash, setBondingsCurveCodeHash] = useState("0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606");
  const [TypeId, setTypeId] = useState("");
  const [slipPoint, setSlipPoint] = useState("");
  const [orderCodeHash, setOrderCodeHash] = useState("0xeca2d82fe00581883c038f00eb5b8f8b79f21e4f4a9c52cd952d50f1f4afc765");
  // setXudtArgs("0x431c4a68c1f4d1344b3dd3d1d3e46f768e45b76212f9042d17fb1d007850ab0f");
  // setBondingsCurveCodeHash("0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606");
  // setTypeId("0x2f0d477394f7b617e264bed54368a12a8b36833d399b74616bfc258490181be8");
  // setOrderCodeHash("0xeca2d82fe00581883c038f00eb5b8f8b79f21e4f4a9c52cd952d50f1f4afc765");
  const ckb_args="0x0000000000000000000000000000000000000000000000000000000000000000"
  
  


  // const CellDepsTxHash = "0xd6a1ba4b8e43384e490615715b768883c1e5f28b2f54d501eb62272d0011879d"
  //const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x756defe0217d1ba946cf67966498ec8d72cfe227632d3c3226dc38ee9ae4ee3d");
  // 将type一开始就定义好，构造异步函数，然后在useEffect中调用
  

  useEffect(() => {
    const calculateEstimatedCkb = async () => {
      if (buyXudtAmount === "" || slipPoint === "" || xudtArgs === "" || bondingsCurveCodeHash === "" || TypeId === "" || orderCodeHash === "") {
        setEstimatedCkb("");
        return;
      }
      const buyAmount = ccc.fixedPointFrom(buyXudtAmount);
      let poolXudtAmount = BigInt(0);

      if (!signer) {
        return;
      }
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, xudtArgs);
      const bondings_lock_args = xudtArgs+TypeId.slice(2)
      const boundingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", bondings_lock_args as ccc.Hex);

      const poolCells = [];
      const boundingsCell = signer.client.findCellsOnChain({
        script: boundingsLock,
        scriptType: "lock",
        scriptSearchMode: "exact",
      });

      for await (const cell of boundingsCell) {
        console.log("cell", cell);
        console.log("txHash", cell.outPoint.txHash);
        
        poolCells.push(cell);
        if (cell.cellOutput.type?.args === type.args) {
          poolXudtAmount += udtBalanceFrom(cell.outputData);
        }
      }
      console.log(`poolXudtAmount: ${poolXudtAmount},totalXudtSupply-poolXudtAmount: ${XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount}`);
      // console.log("buyAmount", buyAmount);
      // console.log("findAmout", findAmount(TOTAL_XUDT_SUPPLY - poolXudtAmount, BigInt(159600), 10000, 'buy'));
      console.log("totalXudtSupply", TOTAL_XUDT_SUPPLY);
      const shouldPayCkbAmount = getBuyPriceAfterFee(XUDT_LAUNCH_AMOUNT+TOTAL_XUDT_SUPPLY - poolXudtAmount, buyAmount);
      console.log("shouldPayCkbAmount", shouldPayCkbAmount);
      setEstimatedCkb(ccc.fixedPointToString(shouldPayCkbAmount, 8));
    };

    const intervalId = setInterval(calculateEstimatedCkb, 3000);
    calculateEstimatedCkb();

    return () => clearInterval(intervalId);

  }, [buyXudtAmount, signer,xudtArgs,bondingsCurveCodeHash,TypeId,orderCodeHash]);

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
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, xudtArgs);
      const bondings_lock_args = xudtArgs+TypeId.slice(2)
      const boundingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", bondings_lock_args as ccc.Hex);

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
      
      const canGetCkbAmount = getSellPriceAfterFee(XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount, sellAmount);
      console.log("canGetCkbAmount", canGetCkbAmount);
      setEstimatedCkbForSell(ccc.fixedPointToString(canGetCkbAmount, 8));
    };
    const intervalId = setInterval(calculateEstimatedCkbForSell, 3000);
    calculateEstimatedCkbForSell();

    return () => clearInterval(intervalId);
  }, [sellXudtAmount, signer,xudtArgs,bondingsCurveCodeHash,TypeId,orderCodeHash]);

  useEffect(() => {
    const calculateEstimatedXudt = async () => {
      if (ckbAmount === "") {
        return;
      }
      const targetSummation = ccc.fixedPointFrom(ckbAmount);
      let poolXudtAmount = BigInt(0);

      if (!signer) {
        return;
      }
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, xudtArgs);
      const bondings_lock_args = xudtArgs+TypeId.slice(2)
      const boundingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", bondings_lock_args as ccc.Hex);

      const poolCells = [];
      const boundingsCell = signer.client.findCellsOnChain({
        script: boundingsLock,
        scriptType: "lock",
        scriptSearchMode: "exact",
      });

      for await (const cell of boundingsCell) {
        console.log("cell", cell);
        poolCells.push(cell);
        if (cell.cellOutput.type?.args === type.args) {
          poolXudtAmount += udtBalanceFrom(cell.outputData);
        }
      }
      console.log(`inputckbAmount: ${targetSummation},poolXudtAmount: ${poolXudtAmount},totalXudtSupply-poolXudtAmount: ${TOTAL_XUDT_SUPPLY - poolXudtAmount}`);
      const xudtAmount = findAmount(XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount, targetSummation, 10000, 'buy');
      console.log("xudtAmount", xudtAmount);
      setBuyXudtAmount(ccc.fixedPointToString(xudtAmount || BigInt(0), 8));
      // setEstimatedXudt(ccc.fixedPointToString(xudtAmount || BigInt(0), 8));
    };

    const intervalId = setInterval(calculateEstimatedXudt, 3000);
    calculateEstimatedXudt();

    return () => clearInterval(intervalId);

    
  }, [ckbAmount, signer,xudtArgs,bondingsCurveCodeHash,TypeId,orderCodeHash]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <div className="mt-2">
        <span>Base Info</span>
      </div>
    
    <TextInput
      label="Enter bondingsCurveCodeHash"
      placeholder="bondingsCurveCodeHash"
      state={[bondingsCurveCodeHash, setBondingsCurveCodeHash]}
    />
    
    <TextInput
      label="Enter orderCodeHash"
      placeholder="orderCodeHash"
      state={[orderCodeHash, setOrderCodeHash]}
    />
    <TextInput
      label="Enter xUDT Args"
      placeholder="0x431c4a68c1f4d1344b3dd3d1d3e46f768e45b76212f9042d17fb1d007850ab0f"
      state={[xudtArgs, setXudtArgs]}
    />
    <TextInput
      label="Enter TypeId"
      placeholder="0x2f0d477394f7b617e264bed54368a12a8b36833d399b74616bfc258490181be8"
      state={[TypeId, setTypeId]}
    />
    <div className="mt-3">
        <span>Trade Info</span>
    </div>
    <TextInput
      label="Enter slipPoint"
      placeholder="slipPoint"
      state={[slipPoint, setSlipPoint]}
    />
    <TextInput
        label="Enter CKB Amount"
        placeholder="Amount of CKB to spend"
        state={[ckbAmount, setCkbAmount]}
      />
      <div className="mt-2">
        <span>Estimated xUDT to Receive: {buyXudtAmount}</span>
      </div>
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
            const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, xudtArgs);
            const bondings_lock_args = xudtArgs+TypeId.slice(2)
            const boundingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", bondings_lock_args as ccc.Hex);

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
            console.log("poolXudtCell", poolXudtCell);
            // if (poolXudtAmount < buyAmount) {
            //   error("Not enough xUDT in the pool");
            //   return;
            // }

            const shouldPayCkbAmount = getBuyPriceAfterFee(XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount, buyAmount);
            console.log("shouldPayCkbAmount", shouldPayCkbAmount);
            let poolCkbCell;
            for (const cell of poolCells) {
              if (cell.cellOutput.type == undefined) {
                poolCkbCell = cell;
              }
            }
            console.log("poolCkbCell", poolCkbCell);
            // 默认1%的滑点
            
            const order_lock_args = constructArgs(boundingsLock.hash(),lock.hash(),xudtArgs,10000,buyAmount)
            console.log("order_lock_args",order_lock_args);
            const parsedArgs = parseArgs(order_lock_args)
            console.log(`bondingsLockHash:${parsedArgs.bondingsLockHash},userPubkey: ${parsedArgs.userPubkey}, xudtArgs: ${parsedArgs.xudtArgs}, slipPoint: ${parsedArgs.slipPoint}, desiredAmount: ${parsedArgs.desiredAmount}`);
            const orderLock =new ccc.Script(orderCodeHash as ccc.Hex,"type",order_lock_args as ccc.Hex)
            // let tx: ccc.Transaction;
            const tx = ccc.Transaction.from({
              inputs: [],
              outputs: [
                // 订单锁，其中144为xudt的包装费，should_pay_ckb_amount为支付到pool的数量
                {  lock:orderLock },
              ],
            });
            // if (poolCkbCell){
              
            // }else {
            //   tx = ccc.Transaction.from({
            //     inputs: [new ccc.CellInput(poolXudtCell!.outPoint, BigInt(0))],
            //     outputs: [
            //       { lock: boundingsLock, type },
            //       { capacity: shouldPayCkbAmount + BigInt(100*100000000), lock: boundingsLock },
            //       { capacity: ccc.fixedPointFrom(144), lock, type },
            //     ],
            //     outputsData: [
            //       ccc.numLeToBytes(udtBalanceFrom(poolXudtCell!.outputData) - buyAmount, 16),
            //       "0x",
            //       ccc.numLeToBytes(buyAmount, 16),
            //     ]
            //   });
            // }

            

            // await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
            // tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(CellDepsTxHash, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
            // await tx.completeInputsByUdt(signer, type);
            await tx.completeFeeBy(signer, 1000);
            tx.outputs[0].capacity+=shouldPayCkbAmount
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
            const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, xudtArgs);
            const bondings_lock_args = xudtArgs+TypeId.slice(2)
            const boundingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", bondings_lock_args as ccc.Hex);

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
            console.log("poolXudtCell", poolXudtCell);
            const canGetCkbAmount = getSellPriceAfterFee(XUDT_LAUNCH_AMOUNT +TOTAL_XUDT_SUPPLY - poolXudtAmount, sellAmount);
            console.log("canGetCkbAmount", canGetCkbAmount);
            const order_lock_args = constructArgs(boundingsLock.hash(),lock.hash(),ckb_args,9900,canGetCkbAmount)
            console.log("order_lock_args",order_lock_args);
            const parsedArgs = parseArgs(order_lock_args)
            console.log(`bondingsLockHash:${parsedArgs.bondingsLockHash} ,userPubkey: ${parsedArgs.userPubkey}, xudtArgs: ${parsedArgs.xudtArgs}, slipPoint: ${parsedArgs.slipPoint}, desiredAmount: ${parsedArgs.desiredAmount}`);
            const orderLock =new ccc.Script(orderCodeHash as ccc.Hex,"type",order_lock_args as ccc.Hex)
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
            console.log("poolCkbCell", poolCkbCell);

            const tx = ccc.Transaction.from({
              inputs: [
              ],
              outputs: [
                // 订单锁，其中144为xudt的包装费，should_pay_ckb_amount为支付到pool的数量
                  {  lock:orderLock,type },
              ],
              outputsData: [
                ccc.numLeToBytes(sellAmount,16),
              ]
            });

            await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
            // tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(CellDepsTxHash, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
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
