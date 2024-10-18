"use client";

import React, { useState } from "react";
import { TextInput } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { Textarea } from "../../../components/Textarea";
import { ccc } from "@ckb-ccc/connector-react";
import { bytesFromAnyString, useGetExplorerLink } from "../../../utils";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";
import {numFrom,udtBalanceFrom} from "@ckb-ccc/connector-react";

export default function Transfer() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [transferTo, setTransferTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [data, setData] = useState<string>("");

  return (
    <div className="flex w-full flex-col items-stretch">
      <Textarea
        label="Address"
        placeholder="Addresses to transfer to, separated by lines"
        state={[transferTo, setTransferTo]}
      />
      <TextInput
        label="Amount"
        placeholder="Amount to transfer for each"
        state={[amount, setAmount]}
      />
      <Textarea
        label="Output Data(Options)"
        state={[data, setData]}
        placeholder="Leave empty if you don't know what this is. Data in the first output. Hex string will be parsed."
      />
      <ButtonsPanel>
        <Button
          onClick={async () => {
            if (!signer) {
              return;
            }
            if (transferTo.split("\n").length !== 1) {
              error("Only one destination is allowed for max amount");
              return;
            }
            // 获取xudt的所有余额
            const xUdtType = await ccc.Script.fromKnownScript(
              signer.client,
              ccc.KnownScript.XUdt,
              "0xf2be170f008edce5630342efc894093820133e944d9091c9b0efe2d29cddca20",
            );
            const { script: me } = await signer.getRecommendedAddressObj();
            log("Your address is", JSON.stringify(me, null, 2));
            const xudt_tx = ccc.Transaction.from({
              outputs: [{lock: me, type: xUdtType}],
              outputsData:[ccc.numLeToBytes(1,16)],
            });
            const { accumulated } = await xudt_tx.completeInputs(
              signer,
              {
                script: xUdtType,
                outputDataLenRange: [16, numFrom("0xffffffff")],
              },
              (acc, { outputData }) => {
                const balance = Number(udtBalanceFrom(outputData));
                const sum = acc + balance;
                return sum;
              },
              0,
            );
            console.log("xudt_tx",xudt_tx);
            // const balance = await xudt_tx.getInputsUdtBalance(signer.client, xUdtType);
            // console.log("You have", balance, "xUDT");
            log("You have", accumulated);
            

            log("Calculating the max amount...");
            // Verify destination address
            const { script: toLock } = await ccc.Address.fromString(
              transferTo,
              signer.client,
            );
            console.log("data",data);
            // Build the full transaction to estimate the fee
            const tx = ccc.Transaction.from({
              outputs: [{ lock: toLock }],
              outputsData: [bytesFromAnyString(data)],
            });
            console.log("tx",tx);

            // Complete missing parts for transaction
            await tx.completeInputsAll(signer);
            // Change all balance to the first output
            await tx.completeFeeChangeToOutput(signer, 0, 1000);
            const amount = ccc.fixedPointToString(tx.outputs[0].capacity);
            log("You can transfer at most", amount, "CKB");
            setAmount(amount);
          }}
        >
          Max Amount
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            if (!signer) {
              return;
            }
            // Verify destination addresses
            const toAddresses = await Promise.all(
              transferTo
                .split("\n")
                .map((addr) => ccc.Address.fromString(addr, signer.client)),
            );

            const tx = ccc.Transaction.from({
              outputs: toAddresses.map(({ script }) => ({ lock: script })),
              outputsData: [bytesFromAnyString(data)],
            });

            // CCC transactions are easy to be edited
            tx.outputs.forEach((output, i) => {
              if (output.capacity > ccc.fixedPointFrom(amount)) {
                error(`Insufficient capacity at output ${i} to store data`);
                return;
              }
              output.capacity = ccc.fixedPointFrom(amount);
            });

            // Complete missing parts for transaction
            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer, 1000);

            // Sign and send the transaction
            log(
              "Transaction sent:",
              explorerTransaction(await signer.sendTransaction(tx)),
            );
          }}
        >
          Transfer
        </Button>
      </ButtonsPanel>
    </div>
  );
}
