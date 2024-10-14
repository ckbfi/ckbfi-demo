"use client";

import React, { useState } from "react";
import { TextInput } from "../../../components/Input";
import { Button } from "../../../components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { Textarea } from "../../../components/Textarea";
import { useGetExplorerLink } from "../../../utils";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";

export default function TransferXUdt() {
  const { signer, createSender } = useApp();
  const { log } = createSender("Transfer xUDT");

  const { explorerTransaction } = useGetExplorerLink();

  const [xUdtArgs, setXUdtArgs] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Args"
        placeholder="xUdt args to transfer"
        state={[xUdtArgs, setXUdtArgs]}
      />
      <Textarea
        label="Address"
        placeholder="Addresses to transfer to, separated by lines"
        state={[transferTo, setTransferTo]}
      />
      <TextInput
        label="amount"
        placeholder="Amount to transfer for each"
        state={[amount, setAmount]}
      />
      <ButtonsPanel>
        <Button
          className="self-center"
          onClick={async () => {
            if (!signer) {
              return;
            }
            const toAddresses = await Promise.all(
              transferTo
                .split("\n")
                .map((addr) => ccc.Address.fromString(addr, signer.client)),
            );
            const { script: change } = await signer.getRecommendedAddressObj();

            const xUdtType = await ccc.Script.fromKnownScript(
              signer.client,
              ccc.KnownScript.XUdt,
              xUdtArgs,
            );

            const tx = ccc.Transaction.from({
              outputs: toAddresses.map(({ script }) => ({
                lock: script,
                type: xUdtType,
              })),
              outputsData: Array.from(Array(toAddresses.length), () =>
                ccc.numLeToBytes(amount, 16),
              ),
            });
            await tx.completeInputsByUdt(signer, xUdtType);
            const balanceDiff =
              (await tx.getInputsUdtBalance(signer.client, xUdtType)) -
              tx.getOutputsUdtBalance(xUdtType);
            if (balanceDiff > ccc.Zero) {
              tx.addOutput(
                {
                  lock: change,
                  type: xUdtType,
                },
                ccc.numLeToBytes(balanceDiff, 16),
              );
            }
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.XUdt,
            );
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
