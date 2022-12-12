import { ConstructorFragment } from "@ethersproject/abi";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import exp from "constants";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TokenSale, TokenSale__factory } from "../typechain-types";
import { MyERC20, MyERC20__factory } from "../typechain-types";
import { MyToken, MyToken__factory} from "../typechain-types";

const TOKEN_ETH_RATIO = 1;
const NFT_PRICE = ethers.utils.parseEther("0.2");

describe("NFT Shop", async () => {
  let accounts: SignerWithAddress[];
  let tokenSaleContract: TokenSale;
  let paymentTokenContract: MyERC20;
  let nftContract: MyToken;

  beforeEach(async function () {
    accounts = await ethers.getSigners();

    const myerc20Factory = new MyERC20__factory(accounts[0]);
    paymentTokenContract = await myerc20Factory.deploy() as MyERC20;
    await paymentTokenContract.deployed();

    const mynftFactory = new MyToken__factory(accounts[0]);
    nftContract = await mynftFactory.deploy() as MyToken;
    await nftContract.deployed();

    const tokenSaleFactory = new TokenSale__factory(accounts[0]);
    tokenSaleContract = await tokenSaleFactory.deploy(TOKEN_ETH_RATIO, NFT_PRICE, paymentTokenContract.address, nftContract.address) as TokenSale;
    await tokenSaleContract.deployed();
    const MINTERROLE = await paymentTokenContract.MINTER_ROLE();
    const giveRoleTx = await paymentTokenContract.grantRole(MINTERROLE, tokenSaleContract.address);
    await giveRoleTx.wait();

    const giveRoleTx2 = await nftContract.grantRole(MINTERROLE, tokenSaleContract.address);
    await giveRoleTx2.wait();
  });

  describe("When the Shop contract is deployed", async () => {
    it("defines the ratio as provided in parameters", async () => {
      const ratio = await tokenSaleContract.ratio();
      expect(ratio).to.eq(TOKEN_ETH_RATIO);
    });

    it("uses a valid ERC20 as payment token", async () => {
      const erc20Tokenaddress = await tokenSaleContract.paymentToken();
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
      const tx = await tokenSaleContract.connect(accounts[1]).purchaseTokens({ value: ETH_SENT });
      const txReceipt = await tx.wait();
      const gasUsage = txReceipt.gasUsed;
      const gasPrice = txReceipt.effectiveGasPrice;
      gasCost = gasUsage.mul(gasPrice);
      balanceAfter = await accounts[1].getBalance();
    });

    it("charges the correct amount of ETH", async () => {

      const ratio = await tokenSaleContract.ratio();
      const expectedBalance = balanceBefore.sub(ETH_SENT.div(ratio)).sub(gasCost);
      expect(balanceAfter).to.eq(expectedBalance);
    });

    it("gives the correct amount of tokens", async () => {
      const balance = await paymentTokenContract.balanceOf(accounts[1].address);
      const ratio = await tokenSaleContract.ratio();
      expect(balance).to.eq(ETH_SENT.div(ratio));
    });


    describe("When a user burns an ERC20 at the Token contract", async () => {
      let gasCost: BigNumber;

      beforeEach(async () => {
        const ratio = await tokenSaleContract.ratio();
        const total = ETH_SENT.div(ratio);
        const allowTx = await paymentTokenContract.connect(accounts[1]).approve(tokenSaleContract.address, total);
        const receiptAllow = await allowTx.wait();
        const burnTx = await tokenSaleContract.connect(accounts[1]).burnTokens(total);
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
        const balance = await paymentTokenContract.balanceOf(accounts[1].address);
        console.log("02 ", balance);
        expect(balance).to.eq(0);
      });

    });

    describe("When a user purchase a NFT from the Shop contract", async () => {
      const NFT_ID = 42;
      let tokenBalanceBefore : BigNumber;

      beforeEach (async () => {
        tokenBalanceBefore = await paymentTokenContract.balanceOf(accounts[1].address);
        const allowTx = await paymentTokenContract.connect(accounts[1]).approve(tokenSaleContract.address, NFT_PRICE);
        const receiptAllow = await allowTx.wait();
        const purchaseTx = await tokenSaleContract.connect(accounts[1]).purchaseNFT(NFT_ID);
        await purchaseTx.wait();
      })

      it("charges the correct amount of token", async () => {
        const tokenBalanceAfter = await paymentTokenContract.balanceOf(accounts[1].address);
        const expectedTokenBalanceAfter = tokenBalanceBefore.sub(NFT_PRICE);
        expect(tokenBalanceAfter).to.eq(expectedTokenBalanceAfter);
      });

      it("gives the right NFT", async () => {
        //contract MyToken is ERC721, AccessControl, ERC721Burnable {
        let contractInterface = nftContract.interface;
        console.log(contractInterface);
                 throw new Error("Not implemented");
      });

      it("updates the owner account correctly", async () => {
        const effectiveOwner = await nftContract.ownerOf(NFT_ID);
        expect(effectiveOwner).to.eq(accounts[1].address);
      });

      it("update the pool account correctly", async () => {
        throw new Error("Not implemented");
      });

      it("favors the pool with the rounding", async () => {
        throw new Error("Not implemented");
      });
    });

    describe("When a user burns their NFT at the Shop contract", async () => {
      it("gives the correct amount of ERC20 tokens", async () => {
        throw new Error("Not implemented");
      });
      it("updates the pool correctly", async () => {
        throw new Error("Not implemented");
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