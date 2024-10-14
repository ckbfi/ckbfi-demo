"use client";
import React, { useState } from "react";
import { Button } from "../../../components/Button";
import { TextInput } from "../../../components/Input";
import { useApp } from "../../../context";
import { ButtonsPanel } from "../../../components/ButtonsPanel";
import axios from "axios";

export default function Sign() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Sign");

  const [messageToSign, setMessageToSign] = useState<string>("");
  const [signature, setSignature] = useState<string>("");
  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Message"
        placeholder="Message to sign and verify"
        state={[messageToSign, setMessageToSign]}
      />
      <ButtonsPanel>
        <Button
          onClick={async () => {
            if (!signer) {
              return;
            }
            const sig = JSON.stringify(await signer.signMessage(messageToSign));
            setSignature(sig);
            log("Signature:", sig);
          }}
        >
          Sign
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            try {
              const ckbAddress =await signer?.getRecommendedAddress()
              const response = await axios.post("http://localhost:50002/ccc-verify", {
                message: messageToSign,
                address: ckbAddress, // 根据需要调整
                sign_response_data: JSON.parse(signature)
              });

              if (response.data.result) {
                log("Valid");
              } else {
                error("Invalid");
              }
            } catch (err) {
              error("Verification failed");
              console.error(err);
            }
          }}
        >
          Verify
        </Button>
      </ButtonsPanel>
    </div>
  );
}
