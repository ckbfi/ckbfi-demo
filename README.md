This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## ckbfi流程体验
* issue xudt（total supply 10亿）
* 创建unique liquidity manager cell 和 bondings curve pool cells（获取生成的type id）
* 创建order sell
* 撮合order sell 与 bondings curve pool

![1.png](https://github.com/ckbfi/ckbfi-demo/blob/main/assets/1.png?raw=true)



### 1.issue xudt

进入http://localhost:3000/connected/IssueXUdtSus

自定义补充好symbol与name后点击issue，连续签名3次交易即可issue成功，点击红框中的txhash链接获取xudt cell的args、txhash与index

![2.png](https://github.com/ckbfi/ckbfi-demo/blob/main/assets/2.png?raw=true)


### 2.创建unique liquidity manager cell 和 bondings curve pool cells

进入http://localhost:3000/connected/createPoolCells

利用步骤1中的所获取的xudt cell的txhash、index、args填充信息，点击create pool并签名后，便可完成unique liquidity manager cell 和 bondings curve pool cells的创建，并记录交易弹窗中的type id



### 3.创建order cell

进入http://localhost:3000/connected/createOrderCell

利用步骤1中的所获取的xudt cell的args与步骤2获取的type id填充信息，自定义需要购买xudt的数量所支付的ckb数量以及滑点，点击buy/sell创建订单，并记录交易弹窗中order cell的txhash与index



### 4.撮合order sell 与 bondings curve pool

进入http://localhost:3000/connected/matchOrderCell

利用步骤3中的所获取的order cell的txhash、index与步骤1获取的xudt cell的args填充信息，点击match便可完成order cell与bondings curve pool的撮合交易

