import { ElementSchemaRegistry } from '@angular/compiler';
import { Component, OnInit } from '@angular/core';
import { ethers } from 'ethers';
import tokenJson from '../assets/MyERC20.json'



const TOKENIZED_VOTES_ADDRESS = "0xA1D703118fe5b3C2dC00835d6169e448B7e8183C";
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent{
  title = 'My Ballot Example';
  lastBlockNumber: number | undefined;

  provider: ethers.providers.Provider ;
  wallet : ethers.Wallet | undefined;
  tokenContract : ethers.Contract | undefined;
  etherBalance : number| undefined;
  tokenBalance: number| undefined;;
  votingPower: number| undefined;;

  constructor(){
    this.lastBlockNumber = 0;
    this.provider = ethers.providers.getDefaultProvider("goerli");
    ethers.getDefaultProvider("goerli").getBlock("latest")
    .then((block) => (this.lastBlockNumber = block.number));
  }


  createWallet(){
    this.wallet = ethers.Wallet.createRandom().connect(this.provider);
    this.tokenContract = new ethers.Contract(
      TOKENIZED_VOTES_ADDRESS, 
      tokenJson.abi, 
      this.wallet);
    this.wallet.getBalance()
    .then((balanceBN:ethers.BigNumber) => {this.etherBalance = parseFloat(ethers.utils.formatEther(balanceBN));});
    
    
    this.tokenContract["balanceOf"](this.wallet.address)
    .then((balanceBN:ethers.BigNumberish) => {this.tokenBalance = parseFloat(ethers.utils.formatEther(balanceBN));});

    this.tokenContract["getVotes"](this.wallet.address)
    .then((voteBN:ethers.BigNumberish) => {this.votingPower = parseFloat(ethers.utils.formatEther(voteBN));});
  }

  claimTokens(){
  }
}
