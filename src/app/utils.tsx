import { ccc } from "@ckb-ccc/connector-react";
import Link from "next/link";

export function tokenInfoToBytes(
  decimals: ccc.NumLike,
  symbol: string,
  name: string,
) {
  const symbolBytes = ccc.bytesFrom(symbol, "utf8");
  const nameBytes = ccc.bytesFrom(name === "" ? symbol : name, "utf8");
  return ccc.bytesConcat(
    ccc.numToBytes(decimals, 1),
    ccc.numToBytes(nameBytes.length, 1),
    nameBytes,
    ccc.numToBytes(symbolBytes.length, 1),
    symbolBytes,
  );
}

export function bytesFromAnyString(str: string): ccc.Bytes {
  try {
    return ccc.bytesFrom(str);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {}

  return ccc.bytesFrom(str, "utf8");
}

export function formatString(
  str: string | undefined,
  l = 9,
  r = 6,
): string | undefined {
  if (str && str.length > l + r + 3) {
    return `${str.slice(0, l)}...${str.slice(-r)}`;
  }
  return str;
}

export function useGetExplorerLink() {
  const { client } = ccc.useCcc();

  const prefix =
    client.addressPrefix === "ckb"
      ? "https://explorer.nervos.org"
      : "https://pudge.explorer.nervos.org";

  return {
    index: prefix,
    explorerAddress: (addr: string, display?: string) => {
      return (
        <Link
          className="underline"
          href={`${prefix}/address/${addr}`}
          target="_blank"
        >
          {display ?? addr}
        </Link>
      );
    },
    explorerTransaction: (txHash: string, display?: string) => {
      return (
        <Link
          className="underline"
          href={`${prefix}/transaction/${txHash}`}
          target="_blank"
        >
          {display ?? txHash}
        </Link>
      );
    },
  };
}


export const TOTAL_XUDT_SUPPLY = BigInt(731000000) * BigInt(100_000_000);
export const XUDT_LAUNCH_AMOUNT = BigInt(200000000) * BigInt(100_000_000);

export function getPrice(currentXudtAmount:bigint, xudtAmount:bigint) {
    
    currentXudtAmount = currentXudtAmount / BigInt(100_000_000);
    xudtAmount = xudtAmount / BigInt(100_000_000);
    // console.log("currentXudtAmount", currentXudtAmount);
    // console.log("xudtAmount", xudtAmount);
    const dg = BigInt(114500000000000)
    const uint128_400_000_000 = BigInt(100000000);
    const uint128_1 = BigInt(1);
    const uint128_2 = BigInt(2);

    const sum1 = (currentXudtAmount + uint128_400_000_000 - uint128_1) *
                 (currentXudtAmount + uint128_400_000_000)  *
                 (uint128_2 * (currentXudtAmount + uint128_400_000_000) - uint128_1)/ dg;
    const sum2 = (currentXudtAmount + uint128_400_000_000 + xudtAmount - uint128_1) *
                 (currentXudtAmount + uint128_400_000_000 + xudtAmount) *
                 (uint128_2 * (currentXudtAmount + uint128_400_000_000) + uint128_2 * xudtAmount - uint128_1)/ dg;
    // console.log("sum1", sum1);
    // console.log("sum2", sum2);
    const summation = sum2 - sum1;
    // console.log("summation", summation);
    return summation;
}

export function getBuyPriceAfterFee(currentXudtAmount:bigint, xudtAmount:bigint, feeRate:bigint=BigInt(250)) {
    const price = getPrice(currentXudtAmount, xudtAmount);
    const fee = price * feeRate / BigInt(10_000);
    return price + fee;
}

export function getSellPriceAfterFee(currentXudtAmount:bigint, xudtAmount:bigint, feeRate:bigint=BigInt(250)) {
    const price = getPrice(currentXudtAmount-xudtAmount,xudtAmount );
    const fee = price * feeRate / BigInt(10_000);
    return price - fee;
}
export function findAmount(
  supply: bigint,
  targetSummation: bigint,
  maxIterations: number = 10000,
  action: 'buy' | 'sell' = 'sell'
): bigint | null {
  let low = BigInt(0); // 都是指xudt的数量
  let high = BigInt(2*800_000_000 * 100_000_000); // 设定一个较大的初始上界
  let iterations = 0;
  let bestMid: bigint | null = null;
  let bestDifference = targetSummation; // 初始为最大可能的差值

  while (low <= high && iterations < maxIterations) {
      const mid = (low + high) / BigInt(2);

      let currentSummation: bigint;
      if (action === 'buy') {
          currentSummation = getBuyPriceAfterFee(supply, mid);
      } else if (action === 'sell') {
          currentSummation = getSellPriceAfterFee(supply, mid);
      } else {
          throw new Error("Action must be 'buy' or 'sell'");
      }

      const difference = targetSummation - currentSummation;

      if (currentSummation <= targetSummation) {
          if (bestMid === null || difference < bestDifference) {
              bestDifference = difference;
              bestMid = mid;
          }
      }

      if (currentSummation < targetSummation) {
          low = mid + BigInt(1);
      } else {
          high = mid - BigInt(1);
      }
      // console.log('currentSummation', currentSummation);
      iterations++;
  }

  // console.log('Max iterations reached', iterations);
  // console.log('Best mid', bestMid);
  return bestMid; // 返回最优解
}

export function constructArgs(
  bondingsLockHash: string,
  userPubkey: string,
  xudtArgs: string,
  slipPoint: number,
  desiredAmount: bigint
): string {
  // Helper function to decode a hex string to a byte array
  function hexToBytes(hex: string): Uint8Array {
      if (hex.startsWith('0x')) {
          hex = hex.slice(2);
      }
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return bytes;
  }

  // Helper function to convert a number to a byte array (big-endian)
  function numberToBytesBE(num: number, byteLength: number): Uint8Array {
      const bytes = new Uint8Array(byteLength);
      for (let i = byteLength - 1; i >= 0; i--) {
          bytes[i] = num & 0xff;
          num >>= 8;
      }
      return bytes;
  }

  // Helper function to convert a bigint to a byte array (big-endian)
  function bigintToBytesBE(bigint: bigint, byteLength: number): Uint8Array {
      const bytes = new Uint8Array(byteLength);
      const byteMask = BigInt(0xff); // 使用 BigInt 构造函数
      const byteShift = BigInt(8); // 使用 BigInt 构造函数
      for (let i = byteLength - 1; i >= 0; i--) {
          bytes[i] = Number(bigint & byteMask);
          bigint >>= byteShift;
      }
      return bytes;
  }

  // Decode the hex strings to byte arrays
  const bondingsLockHashBytes = hexToBytes(bondingsLockHash);
  const userPubkeyBytes = hexToBytes(userPubkey);
  const xudtArgsBytes = hexToBytes(xudtArgs);

  // Convert slipPoint and desiredAmount to byte arrays
  const slipPointBytes = numberToBytesBE(slipPoint, 2);
  const desiredAmountBytes = bigintToBytesBE(desiredAmount, 16);

  // Concatenate all byte arrays
  const args = new Uint8Array(
    bondingsLockHashBytes.length + userPubkeyBytes.length + xudtArgsBytes.length + slipPointBytes.length + desiredAmountBytes.length
  );
  args.set(bondingsLockHashBytes, 0);
  args.set(userPubkeyBytes, bondingsLockHashBytes.length);
  args.set(xudtArgsBytes, userPubkeyBytes.length + bondingsLockHashBytes.length);
  args.set(slipPointBytes, userPubkeyBytes.length + xudtArgsBytes.length + bondingsLockHashBytes.length);
  args.set(desiredAmountBytes, userPubkeyBytes.length + xudtArgsBytes.length + slipPointBytes.length + bondingsLockHashBytes.length);

  // Convert the concatenated byte array to a hex string
  return '0x' + Array.from(args).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function parseArgs(hexString: string) {
  // Helper function to convert a byte array to a hex string
  function bytesToHex(bytes: Uint8Array): string {
      return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Helper function to convert a byte array to a number (big-endian)
  function bytesToNumberBE(bytes: Uint8Array): number {
      let num = 0;
      for (let i = 0; i < bytes.length; i++) {
          num = (num << 8) | bytes[i];
      }
      return num;
  }

  // Helper function to convert a byte array to a bigint (big-endian)
  function bytesToBigIntBE(bytes: Uint8Array): bigint {
      let bigint = BigInt(0);
      for (let i = 0; i < bytes.length; i++) {
          bigint = (bigint << BigInt(8)) | BigInt(bytes[i]);
      }
      return bigint;
  }

  // Remove the '0x' prefix if present
  if (hexString.startsWith('0x')) {
      hexString = hexString.slice(2);
  }

  // Convert the hex string to a byte array
  let args = new Uint8Array(hexString.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

  // Extract the userPubkey (32 bytes), xudtArgs (32 bytes), slipPoint (2 bytes), and desiredAmount (16 bytes)
  const bondingsLockHashBytes = args.slice(0, 32);
  args=args.slice(32)
  const userPubkeyBytes = args.slice(0, 32);
  const xudtArgsBytes = args.slice(32, 64);
  const slipPointBytes = args.slice(64, 66);
  const desiredAmountBytes = args.slice(66, 82);

  // Convert byte arrays back to their original values
  const bondingsLockHash = '0x' + bytesToHex(bondingsLockHashBytes);
  const userPubkey = '0x' + bytesToHex(userPubkeyBytes);
  const xudtArgs = '0x' + bytesToHex(xudtArgsBytes);
  const slipPoint = bytesToNumberBE(slipPointBytes);
  const desiredAmount = bytesToBigIntBE(desiredAmountBytes);

  return {
    bondingsLockHash,
      userPubkey,
      xudtArgs,
      slipPoint,
      desiredAmount
  };
}
