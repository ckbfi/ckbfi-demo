"use client";

import React, { useState } from "react";
import { TextInput } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { ccc, udtBalanceFrom } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "../../../utils";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";
import { parseArgs, findAmount, XUDT_LAUNCH_AMOUNT, TOTAL_XUDT_SUPPLY, getBuyPriceAfterFee, getSellPriceAfterFee } from "../../../utils"; // 假设你有这个工具函数

// 常量定义
const CKB_ARGS = "0x0000000000000000000000000000000000000000000000000000000000000000";



export default function MatchCkbfiOrderCell() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("ckbfi match order");
  const { explorerTransaction } = useGetExplorerLink();

  const [xudtArgs, setXudtArgs] = useState("");
  const [bondingsCurveCodeHash, setBondingsCurveCodeHash] = useState("0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606");
  const [bondingsCurveDepTxHash, setBondingsCurveDepTxHash] = useState("0xf52481b4057257b3439c7c20ec21d7ed270a273a0c09dd23cb75b548cf894d54");
  const [uniqueLiquidityCodeHash, setUniqueLiquidityCodeHash] = useState("0xad5ac9fe1d3cdbe57301be89373ba6f4f154c8af47cfb0c34515758f3e22af5e");
  const [uniqueLiquidityDepTxHash, setUniqueLiquidityDepTxHash] = useState("0x1e3a086fc28b9726b1c8fc9c462bd0f7a3f0f5600e263dab84570fa4077af682");
  const [orderScriptCodeHash, setOrderScriptCodeHash] = useState("0xeca2d82fe00581883c038f00eb5b8f8b79f21e4f4a9c52cd952d50f1f4afc765");
  const [orderScriptDepTxHash, setOrderScriptDepTxHash] = useState("0x253fd25040734d6930d4444dbd863a77c93843a0783d9227c928c6db1f48f7ba");
  const [orderCellTxHash, setOrderCellTxHash] = useState("");
  const [orderCellIndex, setOrderCellIndex] = useState("0");
  const [typeId, setTypeId] = useState("");

  const handleOrderMatch = async () => {
    try {
      if (!signer || !xudtArgs || !bondingsCurveCodeHash || !uniqueLiquidityCodeHash || !orderCellTxHash || !typeId) {
        error("Please fill in all required fields");
        return;
      }



      // 1. 构建bondings curve锁脚本 (xudt_args + type_id)
      const bondingsArgs = xudtArgs + typeId.slice(2);
      const bondingsLock = new ccc.Script(bondingsCurveCodeHash as ccc.Hex, "type", bondingsArgs as ccc.Hex);

      // 2. 构建unique liquidity manager锁脚本
      const uniqueLock = new ccc.Script(uniqueLiquidityCodeHash as ccc.Hex, "type", bondingsArgs as ccc.Hex);

      // 3. 获取pool cells (通过bondings curve锁脚本查询)
      const poolCells = [];
      let poolXudtAmount = BigInt(0);
      let poolCkbAmount = BigInt(0);
      let poolXudtCell;
      let poolCkbCell;

      console.log("Finding bondings curve cells...");
      const boundingsIterator = signer.client.findCellsOnChain({
        script: bondingsLock,
        scriptType: "lock",
        scriptSearchMode: "exact",
      });

      // XUDT类型脚本
      const xUdtType = await ccc.Script.fromKnownScript(
        signer.client,
        ccc.KnownScript.XUdt,
        xudtArgs,
      );

      for await (const cell of boundingsIterator) {
        console.log("Found bondings cell:", cell);
        poolCells.push(cell);

        if (cell.cellOutput.type?.args === xUdtType.args) {
          // 这是XUDT池子
          poolXudtCell = cell;
          poolXudtAmount = udtBalanceFrom(cell.outputData);
          console.log("XUDT Pool Cell amount:", poolXudtAmount.toString());
        } else {
          // 这是CKB池子
          poolCkbCell = cell;
          poolCkbAmount = cell.cellOutput.capacity;
          console.log("CKB Pool Cell amount:", poolCkbAmount.toString());
        }
      }

      if (!poolXudtCell || !poolCkbCell) {
        error("Cannot find complete pool cells");

        return;
      }

      // 4. 获取unique liquidity manager cell
      console.log("Finding unique liquidity cell...");
      const uniqueIterator = signer.client.findCellsOnChain({
        script: uniqueLock,
        scriptType: "lock",
        scriptSearchMode: "exact",
      });

      let uniqueCell;
      for await (const cell of uniqueIterator) {
        uniqueCell = cell;
        console.log("Found unique liquidity cell:", cell);
        break; // 只需要第一个
      }

      if (!uniqueCell) {
        error("Cannot find unique liquidity cell");

        return;
      }

      // 5. 获取订单cell
      console.log("Getting order cell...");
      const orderCell = await signer.client.getCell(new ccc.OutPoint(orderCellTxHash as ccc.Hex, BigInt(orderCellIndex)));
      console.log("Order cell:", orderCell);

      if (!orderCell) {
        error("Order cell not found");

        return;
      }

      // 6. 解析订单参数
      const orderLockArgs = orderCell.cellOutput.lock.args;
      const parsedArgs = parseArgs(orderLockArgs);
      console.log("Parsed order args:", parsedArgs);

      // 7. 判断购买方向
      let isBuyFlag = false;
      if (parsedArgs.xudtArgs === CKB_ARGS) {
        // 使用XUDT类型脚本的args判断
        const orderType = orderCell.cellOutput.type;
        if (orderType && orderType.args === xUdtType.args) {
          // 卖单 (用户有XUDT想要卖出)
          isBuyFlag = false;
          log("This is a SELL order");
        }
      } else {
        // 买单 (用户有CKB想要买入XUDT)
        isBuyFlag = true;
        log("This is a BUY order");
      }

      // 8. 处理订单
      // 检查池子流动性
      if (poolXudtAmount <= XUDT_LAUNCH_AMOUNT || poolCkbAmount === BigInt(0)) {
        error("Insufficient liquidity in pool");

        return;
      }

      // 获取用户锁脚本
      const userCell = await signer.client.getCell(new ccc.OutPoint(orderCellTxHash as ccc.Hex, BigInt(orderCellIndex) + BigInt(1)));
      console.log("user cell:", orderCell);
      const userPubkey = parsedArgs.userPubkey;
      console.log("User pubkey:", userPubkey);

      // 简单实现，实际需要根据锁脚本类型正确构建
      // 假设使用某种标准锁脚本
      let toUserLock: ccc.Script
      if (!userCell) {
        error("User cell not found");

        return;
      } else {
        toUserLock = userCell.cellOutput.lock;
      }


      let tx;

      if (isBuyFlag) {
        // 买单处理逻辑
        console.log("Processing BUY order");

        // 订单能支付的CKB (减去包装费)
        const orderCanPayCkb = orderCell.cellOutput.capacity - ccc.fixedPointFrom(155);
        const orderFee = orderCanPayCkb * BigInt(250) / BigInt(10000);
        const orderCanPayCkbAfterFee = orderCanPayCkb - orderFee;
        console.log(`Order can pay: ${orderCanPayCkb}, fee: ${orderFee}, after fee: ${orderCanPayCkbAfterFee}`);

        // 计算订单所能接受的最少XUDT数量
        const orderDesiredAmount = BigInt(parsedArgs.desiredAmount);
        const desiredAmountAfterSlipe = orderDesiredAmount - orderDesiredAmount * BigInt(parsedArgs.slipPoint) / BigInt(10000);
        console.log(`Desired amount: ${orderDesiredAmount}, after slippage: ${desiredAmountAfterSlipe}`);

        // 根据bondings curve计算出订单所能获取的XUDT数量
        let poolCanPayXudt = findAmount(
          XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount,
          orderCanPayCkbAfterFee,
          10000,
          'buy',
        );
        if (poolCanPayXudt === null) {
          error("Cannot find amount");

          return;
        }

        let should_refund_flag = false;

        // 检查池子XUDT是否足够
        if (poolXudtAmount - poolCanPayXudt < XUDT_LAUNCH_AMOUNT) {
          poolCanPayXudt = poolXudtAmount - XUDT_LAUNCH_AMOUNT;
          should_refund_flag = true;
        }

        console.log(`Pool can pay XUDT: ${poolCanPayXudt}`);

        // 计算最终支付给池子的CKB
        const orderFinalPayToPoolCkb = getBuyPriceAfterFee(
          XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount,
          poolCanPayXudt
        );
        console.log(`Final payment to pool: ${orderFinalPayToPoolCkb}`);

        if (poolCanPayXudt > desiredAmountAfterSlipe) {
          // 订单可以被满足
          log("Order can be satisfied");

          // 构建交易
          tx = ccc.Transaction.from({
            inputs: [
              {
                previousOutput: new ccc.OutPoint(orderCellTxHash as ccc.Hex, BigInt(orderCellIndex)),
              },
              {
                previousOutput: new ccc.OutPoint(poolCkbCell.outPoint.txHash, BigInt(poolCkbCell.outPoint.index)),
              },
              {
                previousOutput: new ccc.OutPoint(poolXudtCell.outPoint.txHash, BigInt(poolXudtCell.outPoint.index)),
              },
              {
                previousOutput: new ccc.OutPoint(uniqueCell.outPoint.txHash, BigInt(uniqueCell.outPoint.index)),
              }
            ],
          });

          // 更新typeId data
          const typeIdDataBytes = new Uint8Array(32);

          if (!should_refund_flag) {
            // 正常交易
            // pool xudt cell
            tx.addOutput({
              lock: bondingsLock,
              type: xUdtType,
              capacity: poolXudtCell.cellOutput.capacity,
            }, ccc.numLeToBytes(poolXudtAmount - poolCanPayXudt, 16));
            // user xudt cell
            tx.addOutput({
              lock: toUserLock,
              type: xUdtType,
              capacity: BigInt(155 * 10 ** 8)
            }, ccc.numLeToBytes(poolCanPayXudt, 16));
            // pool ckb cell
            tx.addOutput({
              lock: bondingsLock,
              capacity: poolCkbAmount + orderFinalPayToPoolCkb,
            });

            const xudtLiquididtyData = ccc.numLeToBytes(poolXudtAmount - poolCanPayXudt, 16);
            const ckbLiquididtyData = ccc.numLeToBytes(poolCkbAmount + orderFinalPayToPoolCkb, 16);
            typeIdDataBytes.set(xudtLiquididtyData, 0);
            typeIdDataBytes.set(ckbLiquididtyData, 16);
          }

          // 更新unique liquidity manager cell
          tx.addOutput({
            lock: uniqueLock,
            type: uniqueLock,
          }, '0x' + Buffer.from(typeIdDataBytes).toString('hex') as ccc.Hex);
        } else {
          error("Order cannot be satisfied due to slippage");

          return;
        }
      } else {
        // 卖单处理逻辑
        console.log("Processing SELL order");

        // 订单能支付的XUDT
        const orderCanPayXudt = udtBalanceFrom(orderCell.outputData);
        console.log(`Order can pay XUDT: ${orderCanPayXudt}`);

        // 计算订单所能接受的最少CKB数量
        const orderDesiredAmount = BigInt(parsedArgs.desiredAmount);
        const desiredAmountAfterSlipe = orderDesiredAmount * BigInt(10000 - parsedArgs.slipPoint) / BigInt(10000);
        console.log(`Desired amount: ${orderDesiredAmount}, after slippage: ${desiredAmountAfterSlipe}`);

        // 根据bondings curve计算订单可获得的CKB
        const poolCanPayCkb = getSellPriceAfterFee(XUDT_LAUNCH_AMOUNT + TOTAL_XUDT_SUPPLY - poolXudtAmount, orderCanPayXudt, BigInt(0));
        console.log(`Pool can pay CKB: ${poolCanPayCkb}`);

        // 手续费
        const orderFee = poolCanPayCkb * BigInt(250) / BigInt(10000);
        console.log(`Order fee: ${orderFee}`);
        const poolFinalPayToUserCkb = poolCanPayCkb - orderFee;
        console.log(`Final payment to user: ${poolFinalPayToUserCkb}`);

        if (poolFinalPayToUserCkb > desiredAmountAfterSlipe) {
          // 订单可以被满足
          log("Order can be satisfied");

          // 构建交易
          tx = ccc.Transaction.from({
            inputs: [
              {
                previousOutput: new ccc.OutPoint(orderCellTxHash as ccc.Hex, BigInt(orderCellIndex)),
              },
              {
                previousOutput: new ccc.OutPoint(poolXudtCell.outPoint.txHash, BigInt(poolXudtCell.outPoint.index)),
              },
              {
                previousOutput: new ccc.OutPoint(poolCkbCell.outPoint.txHash, BigInt(poolCkbCell.outPoint.index)),
              },
              {
                previousOutput: new ccc.OutPoint(uniqueCell.outPoint.txHash, BigInt(uniqueCell.outPoint.index)),
              }
            ],
            outputs: [
              // pool xudt cell
              {
                lock: bondingsLock,
                type: xUdtType,
              },
              // pool ckb cell
              {
                lock: bondingsLock,
                capacity: poolCkbAmount - poolCanPayCkb,
              },
              // user cell
              {
                lock: toUserLock,
                capacity: poolFinalPayToUserCkb + BigInt(orderCell.cellOutput.capacity),
              },
            ],
            outputsData: [
              ccc.numLeToBytes(poolXudtAmount + orderCanPayXudt, 16),
              "0x",
              "0x",
            ],
          });

          // 更新typeId data
          const typeIdDataBytes = new Uint8Array(32);
          const xudtLiquididtyData = ccc.numLeToBytes(poolXudtAmount + orderCanPayXudt, 16);
          const ckbLiquididtyData = ccc.numLeToBytes(poolCkbAmount - poolCanPayCkb, 16);
          typeIdDataBytes.set(xudtLiquididtyData, 0);
          typeIdDataBytes.set(ckbLiquididtyData, 16);

          // 更新unique liquidity manager cell
          tx.addOutput({
            lock: uniqueLock,
            type: uniqueLock,
          }, '0x' + Buffer.from(typeIdDataBytes).toString('hex') as ccc.Hex);
        } else {
          error("Order cannot be satisfied due to slippage");

          return;
        }
      }

      // 完成交易构建
      if (tx) {
        // 添加依赖
        await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
        tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(bondingsCurveDepTxHash as ccc.Hex, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
        tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(orderScriptDepTxHash as ccc.Hex, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
        tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint(uniqueLiquidityDepTxHash as ccc.Hex, BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
        console.log("bondingsCurveDepTxHash:", bondingsCurveDepTxHash);
        console.log("orderScriptDepTxHash:", orderScriptDepTxHash);
        console.log("uniqueLiquidityDepTxHash:", uniqueLiquidityDepTxHash);

        console.log("Transaction:", tx);
        // 添加手续费
        await tx.completeFeeBy(signer, 5000);

        // 发送交易
        const txHash = await signer.sendTransaction(tx);
        log("Transaction sent:", explorerTransaction(txHash));
      }
    } catch (e) {
      const errStr = String(e);
      console.log("e", errStr);
      if (errStr.includes("Insufficient")) {
        // 请等待上一个交易完成或检查余额是否足够
        error("please wait for the previous transaction to complete or check if the balance is sufficient\n" + errStr);
      } else {
        error("errStr");
      }
    }
  };

  return (
    <div className="flex w-full flex-col items-stretch">
      <div className="mt-2">
        <span>Base Info</span>
      </div>
      <TextInput
        label="Enter order Script Code Hash"
        placeholder="0xeca2d82fe00581883c038f00eb5b8f8b79f21e4f4a9c52cd952d50f1f4afc765"
        state={[orderScriptCodeHash, setOrderScriptCodeHash]}
      />
      <TextInput
        label="Enter order Script Dep Tx Hash"
        placeholder="0x1e3a086fc28b9726b1c8fc9c462bd0f7a3f0f5600e263dab84570fa4077af682"
        state={[orderScriptDepTxHash, setOrderScriptDepTxHash]}
      />
      <TextInput
        label="Enter bondingsCurveCodeHash"
        placeholder="bondingsCurveCodeHash"
        state={[bondingsCurveCodeHash, setBondingsCurveCodeHash]}
      />
      <TextInput
        label="Enter bondingsCurveDepTxHash"
        placeholder="bondingsCurveDepTxHash"
        state={[bondingsCurveDepTxHash, setBondingsCurveDepTxHash]}
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
      <div className="mt-2">
        <span>Trade Info</span>
      </div>
      <TextInput
        label="Enter type id"
        placeholder="type id"
        state={[typeId, setTypeId]}
      />
      <TextInput
        label="Enter order Cell Tx Hash"
        placeholder="0xa161a8cb20ba6b79e86f297d5c5c8a44681a521fe08bf352ab5c9401a8a66606"
        state={[orderCellTxHash, setOrderCellTxHash]}
      />
      <TextInput
        label="Enter order Cell Index"
        placeholder="0"
        state={[orderCellIndex, setOrderCellIndex]}
      />
      <TextInput
        label="Enter xUDT Args"
        placeholder="xUDT Args"
        state={[xudtArgs, setXudtArgs]}
      />

      <ButtonsPanel>
        <Button
          className="self-center"
          onClick={handleOrderMatch}
        >
          Match Order
        </Button>
      </ButtonsPanel>
    </div>
  );
}
