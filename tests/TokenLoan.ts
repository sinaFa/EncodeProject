import { ConstructorFragment } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import exp from "constants";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TokenLoan, TokenLoan__factory } from "../typechain-types";
import { MyERC20, MyERC20__factory } from "../typechain-types";

const INTERESTS_RATIO = 12;
const FEES_RATIO = 5;
const TOKEN_PRICE = ethers.utils.parseEther("0.2");

describe("Token Loan", async () => {
  let accounts: SignerWithAddress[];
  let loanContract: TokenLoan;
  let erc20Contract: MyERC20;

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const myerc20Factory = new MyERC20__factory(accounts[0]);
    erc20Contract = await myerc20Factory.deploy() as MyERC20;
    await erc20Contract.deployed();

    const loanFactory = new TokenLoan__factory(accounts[0]);
    loanContract = await loanFactory.deploy(INTERESTS_RATIO, FEES_RATIO, TOKEN_PRICE, erc20Contract.address) as TokenLoan;
    await loanContract.deployed();

    const MINTERROLE = await erc20Contract.MINTER_ROLE();
    const giveRoleTx = await erc20Contract.grantRole(MINTERROLE, loanContract.address);
    await giveRoleTx.wait();
  });

  describe("When the loan contract is deployed", async () => {
    it("defines the ratio as provided in parameters", async () => {
      const ratio = await loanContract.interestsRatio();
      expect(ratio).to.eq(INTERESTS_RATIO);
    });

    it("uses a valid ERC20 as payment token", async () => {
      const erc20Tokenaddress = await loanContract.placementToken();
      const myerc20Factory = new MyERC20__factory(accounts[0]);
      const erc20TokenContract = myerc20Factory.attach(erc20Tokenaddress);
      await expect(erc20TokenContract.totalSupply()).not.to.be.reverted;
    });
  });

  describe("When a user purchase an ERC20 from the Token contract", async () => {

    const ETH_SENT = ethers.utils.parseEther("1");
    let balanceBefore: BigNumber;
    let gasCost: BigNumber;
    let balanceAfter: BigNumber;

    beforeEach(async () => {
      balanceBefore = await accounts[1].getBalance();
      //console.log(`balanceBefore = ${balanceBefore}`);
      const tx = await loanContract.connect(accounts[1]).purchaseTokens({ value: ETH_SENT });
      const txReceipt = await tx.wait();
      const gasUsage = txReceipt.gasUsed;
      const gasPrice = txReceipt.effectiveGasPrice;
      gasCost = gasUsage.mul(gasPrice);
/*      console.log(`gasUsage = ${gasUsage}`);
      console.log(`gasPrice = ${gasPrice}`);
      console.log(`gasCost = ${gasCost}`);
      */
      balanceAfter = await accounts[1].getBalance();
      //console.log(`balanceAfter = ${balanceAfter}`);
    });

    it("charges the correct amount of ETH", async () => {
      const tokenPrice = await loanContract.tokenPrice();
      console.log(`tokenPrice = ${tokenPrice}`);
      console.log(`balanceBefore = ${balanceBefore}`);
      console.log(`ETH_SENT   = ${ETH_SENT}`);
      console.log(`tokenPrice = ${tokenPrice}`);
      const expectedBalance = balanceBefore.sub(ETH_SENT.div(tokenPrice)).sub(gasCost);
      expect(balanceAfter).to.eq(expectedBalance);
    });

    it("gives the correct amount of tokens", async () => {
      const balance = await erc20Contract.balanceOf(accounts[1].address);
      const ratio = await loanContract.tokenPrice();
      expect(balance).to.eq(ETH_SENT.div(ratio));
    });


    describe("When a user burns an ERC20 at the Token contract", async () => {
      let gasCost: BigNumber;

      beforeEach(async () => {
        const ratio = await loanContract.tokenPrice();
        const total = ETH_SENT.div(ratio);
        const allowTx = await erc20Contract.connect(accounts[1]).approve(loanContract.address, total);
        const receiptAllow = await allowTx.wait();
        const burnTx = await loanContract.connect(accounts[1]).burnTokens(total);
        const receiptBurn = await burnTx.wait();
        gasCost = receiptAllow.gasUsed.mul(receiptAllow.effectiveGasPrice).add(receiptBurn.gasUsed.mul(receiptBurn.effectiveGasPrice));
      });

      it("gives the correct amount of ETH", async () => {
        const balanceAfterBurn = await accounts[1].getBalance();
        const expectedBalance = balanceAfter.sub(gasCost).add(ETH_SENT);
        const error = expectedBalance.sub(balanceAfterBurn);
        expect(error).to.eq(0);
      });

      it("burns the correct amount of tokens", async () => {
        const balance = await erc20Contract.balanceOf(accounts[1].address);
        console.log("02 ", balance);
        expect(balance).to.eq(0);
      });

    });

    describe("When the owner withdraw from the Shop contract", async () => {
      it("recovers the right amount of ERC20 tokens", async () => {
        throw new Error("Not implemented");
      });

      it("updates the owner account correctly", async () => {
        throw new Error("Not implemented");
      });
    });

  });
});