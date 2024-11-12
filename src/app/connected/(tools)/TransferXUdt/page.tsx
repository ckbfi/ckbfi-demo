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
    const dg = BigInt(133) * BigInt("10000000000000000000000000000000");
    const uint128_400_000_000 = BigInt(4) * BigInt(100_000_000);
    const uint128_1 = BigInt(1);
    const uint128_2 = BigInt(2);

    const sum1 = (currentXudtAmount + uint128_400_000_000 - uint128_1) *
                 (currentXudtAmount + uint128_400_000_000) / dg *
                 (uint128_2 * (currentXudtAmount + uint128_400_000_000) - uint128_1);
    const sum2 = (currentXudtAmount + uint128_400_000_000 + xudtAmount - uint128_1) *
                 (currentXudtAmount + uint128_400_000_000 + xudtAmount) / dg *
                 (uint128_2 * (currentXudtAmount + uint128_400_000_000) + uint128_2 * xudtAmount - uint128_1);
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
  const { log,error } = createSender("bonding-curve trade xUDT");

  const { explorerTransaction } = useGetExplorerLink();

  const [buyXudtAmount, setBuyXudtAmount] = useState("");
  const [sellXudtAmount, setSellXudtAmount] = useState("");
  const [estimatedCkb, setEstimatedCkb] = useState("");
  const [estimatedCkbForSell, setEstimatedCkbForSell] = useState("");

  useEffect(() => {
    const calculateEstimatedCkb = async () => {
      if (buyXudtAmount === "") {
        setEstimatedCkb("");
        return;
      }
      const buyAmount = ccc.fixedPointFrom(buyXudtAmount);
      let poolXudtAmount = BigInt(0);

      const boundingsLock = new ccc.Script("0xb310496be546e52f9319891b749bb9db7fec31356335feff7c6a5d0b13553333", "type", "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");
      if (!signer) {
        return;
      }
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");

      const poolCells = [];
      const boundingsCell = signer.client.findCells({
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

      const boundingsLock = new ccc.Script("0xb310496be546e52f9319891b749bb9db7fec31356335feff7c6a5d0b13553333", "type", "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");
      if (!signer) {
        return;
      }
      const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");

      const poolCells = [];
      const boundingsCell = signer.client.findCells({
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
            let poolXudtCell;
            const poolCells = [];
            const boundingsLock = new ccc.Script("0xb310496be546e52f9319891b749bb9db7fec31356335feff7c6a5d0b13553333", "type", "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");
            const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");

            const boundingsCell = signer.client.findCells({
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

            const shouldPayCkbAmount = getBuyPriceAfterFee(TOTAL_XUDT_SUPPLY - poolXudtAmount, buyAmount);
            let poolCkbCell;
            for (const cell of poolCells) {
              if (cell.cellOutput.type == undefined) {
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
                { capacity: poolCkbCell!.cellOutput.capacity + shouldPayCkbAmount, lock: boundingsLock },
                { capacity: ccc.fixedPointFrom(144), lock, type },
              ],
              outputsData: [
                ccc.numLeToBytes(udtBalanceFrom(poolXudtCell!.outputData) - buyAmount, 16),
                ccc.numLeToBytes(0),
                ccc.numLeToBytes(buyAmount, 16),
              ]
            });

            await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
            tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint("0xf42e2febc2b07eb7c07a0824abcc38d6cf251cb10e17e3de37b4351f30ee24ec", BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
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
            let poolXudtCell;
            const poolCells = [];
            const boundingsLock = new ccc.Script("0xb310496be546e52f9319891b749bb9db7fec31356335feff7c6a5d0b13553333", "type", "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");
            const type = await ccc.Script.fromKnownScript(signer.client, ccc.KnownScript.XUdt, "0x85ea1f0465f2e0696d1441ee7f51d13d927145d662137088320225278362f91c");

            const boundingsCell = signer.client.findCells({
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
            if (canGetCkbAmount < ccc.fixedPointFrom(64)) {
              error("can not sell less than 64 CKB");
              return;
            }
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
                { capacity: canGetCkbAmount, lock },
              ],
              outputsData: [
                ccc.numLeToBytes(udtBalanceFrom(poolXudtCell!.outputData) + sellAmount, 16),
              ]
            });

            await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.XUdt);
            tx.addCellDepsAtStart(new ccc.CellDep(new ccc.OutPoint("0xf42e2febc2b07eb7c07a0824abcc38d6cf251cb10e17e3de37b4351f30ee24ec", BigInt(0)), ccc.depTypeFrom("code")) as ccc.CellDepLike);
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
                    capacity: ccc.fixedPointFrom(144),
                    type,
                  },
                  ccc.numLeToBytes(balanceDiff, 16),
                );
              }
            // Complete missing parts: Fill inputs
            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer, 1000);
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
