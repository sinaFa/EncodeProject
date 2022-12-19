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
const TOKEN_PRICE = 0.2;
//const TOKEN_PRICE = ethers.utils.parseEther("0.2");

interface IPlacement {
  startingDate: BigNumber;
  amount: BigNumber;
}
let placement: IPlacement;

interface IPlacementResults {
  profits: BigNumber;
  penaltyRatio: BigNumber;
  penalties: BigNumber;
}
let placementResults: IPlacementResults;

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
    //    ethers.utils.parseEther(BET_FEE.toFixed(18))

    loanContract = await loanFactory.deploy(
      ethers.utils.parseEther(INTERESTS_RATIO.toFixed(18)), 
      ethers.utils.parseEther(FEES_RATIO.toFixed(18)), 
      ethers.utils.parseEther(TOKEN_PRICE.toFixed(18)), 
      erc20Contract.address
    ) as TokenLoan;

    await loanContract.deployed();

    const MINTERROLE = await erc20Contract.MINTER_ROLE();
    const giveRoleTx = await erc20Contract.grantRole(MINTERROLE, loanContract.address);
    await giveRoleTx.wait();
  });

  describe("When the loan contract is deployed", async () => {
    it("defines the ratio as provided in parameters", async () => {
      const ratio = await loanContract.interestsRatio();
      expect(ratio).to.eq(ethers.utils.parseEther(INTERESTS_RATIO.toString()));
    });

    it("uses a valid ERC20 as payment token", async () => {
      const erc20Tokenaddress = await loanContract.placementToken();
      const myerc20Factory = new MyERC20__factory(accounts[0]);
      const erc20TokenContract = myerc20Factory.attach(erc20Tokenaddress);
      await expect(erc20TokenContract.totalSupply()).not.to.be.reverted;
    });
  });

  describe("When a user purchase an ERC20 from the loan contract", async () => {

    const ETH_SENT = ethers.utils.parseEther("1");
    const STAKE_TOKENS = 3;
    const PERIODS_PER_YEAR = 24;
    let balanceBefore: BigNumber;
    let gasCost: BigNumber;
    let balanceAfter: BigNumber;

    beforeEach(async () => {
      balanceBefore = await accounts[1].getBalance();
      //      console.log("balanceBefore = " + ethers.utils.formatEther(balanceBefore));
      const tx = await loanContract.connect(accounts[1]).purchaseTokens({ value: ETH_SENT });
      const txReceipt = await tx.wait();
      const gasUsage = txReceipt.gasUsed;
      const gasPrice = txReceipt.effectiveGasPrice;
      gasCost = gasUsage.mul(gasPrice);
      balanceAfter = await accounts[1].getBalance();

      //      console.log("balanceAfter = " + ethers.utils.formatEther(balanceAfter));
      const tokenPrice = await loanContract.tokenPrice();
      const expectedBalance = balanceBefore.sub(ETH_SENT).sub(gasCost);
      //      console.log("expectedBalance = " + ethers.utils.formatEther(expectedBalance));
    });

    it("charges the correct amount of ETH", async () => {
      const tokenPrice = await loanContract.tokenPrice();
      const expectedBalance = balanceBefore.sub(ETH_SENT).sub(gasCost);
      expect(balanceAfter).to.eq(expectedBalance);
    });

    it("gives the correct amount of tokens", async () => {
      const balance = await erc20Contract.balanceOf(accounts[1].address);
      const ratio = await loanContract.tokenPrice();
      expect(balance).to.eq(ETH_SENT.div(ratio));
    });

    describe("When the user stake some tokens", async () => {

      let initialAmountOfTokens: BigNumber;
      let initialSmartContractTokenBalance: BigNumber;
      let startingDate: Number;

      beforeEach(async () => {
        initialAmountOfTokens = await erc20Contract.balanceOf(accounts[1].address);
        initialSmartContractTokenBalance = await erc20Contract.balanceOf(loanContract.address);
        const allowTx = await erc20Contract.connect(accounts[1]).approve(loanContract.address, STAKE_TOKENS * 2);
        await allowTx.wait();

        const tx = await loanContract.connect(accounts[1]).stakeTokens(STAKE_TOKENS);
        const txReceipt = await tx.wait();

        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        startingDate = block.timestamp;
      });

      it("reduces the correct amount of tokens", async () => {
        const currentAmountOfTokens = await erc20Contract.balanceOf(accounts[1].address);
        expect(currentAmountOfTokens).to.eq(initialAmountOfTokens.sub(STAKE_TOKENS));
      });

      it("charges the smart contract balance of tokens", async () => {
        const currentSmartContractBalanceofToken = await erc20Contract.balanceOf(loanContract.address);
        expect(currentSmartContractBalanceofToken).to.eq(initialSmartContractTokenBalance.add(STAKE_TOKENS));
      });

      it("has the correct placement", async () => {
        placement = await loanContract.connect(accounts[1]).placements(accounts[1].address);
        expect(placement.startingDate).to.eq(startingDate);
        expect(placement.amount).to.eq(STAKE_TOKENS);
      });

      // profits = STAKE_TOKENS * PERIODS * INTERESTS_RATIO / 100 / PERIODS_PER_YEAR
      // penalties = profits * penaltyRatio / 100 

      it("can check less than one month profits", async () => {
        const PERIODS = 1;
        placementResults = await loanContract.connect(accounts[1]).calculateResults(PERIODS);
        expect(placementResults.profits).to.eq(0);
      });

      it("can check one month profits", async () => {
        const PERIODS = 2;
        const EXPECTED_PENALTY_RATIO = 5;
        const EXPECTED_PROFITS = STAKE_TOKENS * PERIODS * INTERESTS_RATIO / (100 * PERIODS_PER_YEAR);
        const EXPECTED_PENALTIES = EXPECTED_PROFITS * EXPECTED_PENALTY_RATIO / 100;

        placementResults = await loanContract.connect(accounts[1]).calculateResults(PERIODS);

        expect(placementResults.penaltyRatio).to.eq(EXPECTED_PENALTY_RATIO);
        expect(placementResults.profits).to.eq(ethers.utils.parseEther(EXPECTED_PROFITS.toString()));
        expect(placementResults.penalties).to.eq(ethers.utils.parseEther(EXPECTED_PENALTIES.toString()));
      });

      it("can check one quarter profits", async () => {
        const PERIODS = 6;
        const EXPECTED_PENALTY_RATIO = 3;
        const EXPECTED_PROFITS = STAKE_TOKENS * PERIODS * INTERESTS_RATIO / (100 * PERIODS_PER_YEAR);
        const EXPECTED_PENALTIES = EXPECTED_PROFITS * EXPECTED_PENALTY_RATIO / 100;

        placementResults = await loanContract.connect(accounts[1]).calculateResults(PERIODS);

        expect(placementResults.penaltyRatio).to.eq(EXPECTED_PENALTY_RATIO);
        expect(placementResults.profits).to.eq(ethers.utils.parseEther(EXPECTED_PROFITS.toString()));
        expect(placementResults.penalties).to.eq(ethers.utils.parseEther(EXPECTED_PENALTIES.toString()));
      });

      it("can check one semester profits", async () => {
        const PERIODS = 12;
        const EXPECTED_PENALTY_RATIO = 2;
        const EXPECTED_PROFITS = STAKE_TOKENS * PERIODS * INTERESTS_RATIO / (100 * PERIODS_PER_YEAR);
        const EXPECTED_PENALTIES = EXPECTED_PROFITS * EXPECTED_PENALTY_RATIO / 100;

        placementResults = await loanContract.connect(accounts[1]).calculateResults(PERIODS);

        expect(placementResults.penaltyRatio).to.eq(EXPECTED_PENALTY_RATIO);
        expect(placementResults.profits).to.eq(ethers.utils.parseEther(EXPECTED_PROFITS.toString()));
        expect(placementResults.penalties).to.eq(ethers.utils.parseEther(EXPECTED_PENALTIES.toString()));
      });

      it("can check one year profits", async () => {
        const PERIODS = 24;
        const EXPECTED_PENALTY_RATIO = 1;
        const EXPECTED_PROFITS = STAKE_TOKENS * PERIODS * INTERESTS_RATIO / (100 * PERIODS_PER_YEAR);
        const EXPECTED_PENALTIES = EXPECTED_PROFITS * EXPECTED_PENALTY_RATIO / 100;

        placementResults = await loanContract.connect(accounts[1]).calculateResults(PERIODS);

        expect(placementResults.penaltyRatio).to.eq(EXPECTED_PENALTY_RATIO);
        expect(placementResults.profits).to.eq(ethers.utils.parseEther(EXPECTED_PROFITS.toString()));
        expect(placementResults.penalties).to.eq(ethers.utils.parseEther(EXPECTED_PENALTIES.toString()));
      });

      describe("When the user unstake some tokens", async () => {
        let currentAmountOfTokens: BigNumber;
        let currentSmartContractTokenBalance: BigNumber;

        beforeEach(async () => {
          currentAmountOfTokens = await erc20Contract.balanceOf(accounts[1].address);
          currentSmartContractTokenBalance = await erc20Contract.balanceOf(loanContract.address);
          placement = await loanContract.connect(accounts[1]).placements(accounts[1].address);

          console.log(`currentAmountOfTokens = ${currentAmountOfTokens}`);
          console.log(`currentSmartContractTokenBalance = ${currentSmartContractTokenBalance}`);
          console.log(`STAKE_TOKENS = ${STAKE_TOKENS}`);
          console.log(placement);
          const allowTx = await erc20Contract.connect(accounts[1]).approve(loanContract.address, STAKE_TOKENS);
          await allowTx.wait();
          const tx = await loanContract.connect(accounts[1]).unstakeTokens(STAKE_TOKENS);
          await tx.wait();
        });

        it("retreives his/her tokens, plus some potential interests", async () => {
          console.log("toto");
        });
        it("reduces smart contract balance of token, and adds some potentiel penalties", async () => {
          throw new Error("Not implemented");
        });
      })
    });

    describe("When a user burns an ERC20 at the loan contract", async () => {
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