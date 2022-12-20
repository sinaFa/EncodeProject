A Stacking solution

# Introduction

This project demonstrates stacking solution. 
It comes with 
- two smart contracts
- tests suite
- script to deploys these contracts

# Contributors
- Engin Erdogan
- Oleg Lodygensky
- Sina Fakheri


# Requirements

1. end users can buy / sell ERC20 throught the loan contract
2. end users can stake ERC20 and earn interests (12%APY for 1 year stacking)
3. end users can freely stake up to 100% of their ERC20
    1. they must provide the amount to stake
    2. they must provide the duration of stake
4. end users can unstake when they want
5. there may be penalties depending of the duration of their stake
    1. less than one month  => 5% penality
    2. between 1 to 3 months => 3% penality
    3. between 3 to 6 months => 2% penality
    4. from 6 months and more => 1% fees
5. interests are calculed for the amount of 2 weeks periods
6. end users can burn their own NOT STAKED token when they want and retreive their Eth

# Implementation

## Smart contracts
```
contracts/myerc20.sol
contracts/TokenLoan.sol
```

## Test suite
```
tests/TokenLoan.ts
```

# Security

Smart contract security is of first importance.

We used slither.

## Slither 
We checked security using slither

```shell
python3 -m venv slither
source slither/bin/activate
npm i
npm install -g truffle
slither contracts/TokenLoan.sol --print contract-summary --truffle-ignore-compile
```
### Security audit

Slither gave one high severity and two medium severity advices. 
We did not took time to solve low severity advices.

1. a hight severity warning regarding arbitrary users
```
slither contracts/TokenLoan.sol

TokenLoan.burnTokens(uint256) (contracts/TokenLoan.sol#82-85) sends eth to arbitrary user
	Dangerous calls:
	- address(msg.sender).transfer(amount * tokenPrice) (contracts/TokenLoan.sol#84)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#functions-that-send-ether-to-arbitrary-destinations
```

This was due to the fact we did not check who we were sending Eth to
 ```
function purchaseTokens() external payable {
    placementToken.mint(msg.sender, msg.value / tokenPrice);
}

function burnTokens(uint256 amount) external {
    placementToken.burnFrom(msg.sender, amount);
    payable(msg.sender).transfer(amount * tokenPrice);
}
```

We corrected like this and the error disapeared
```
mapping(address => bool) public users;

function purchaseTokens() external payable {
    users[msg.sender] = true;
    placementToken.mint(msg.sender, msg.value / tokenPrice);
}

function burnTokens(uint256 amount) external {
    require(users[msg.sender] == true);
    placementToken.burnFrom(msg.sender, amount);
    payable(msg.sender).transfer(amount * tokenPrice);
}

```

2. a medium severity warning regarding ERC20 incorrect interface
```
IMyERC20Token (contracts/TokenLoan.sol#4-12) has incorrect ERC20 function interface:IMyERC20Token.transferFrom(address,address,uint256) (contracts/TokenLoan.sol#9)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-erc20-interface
```

This was due to the fact that our interface did not defined the return statement
 ```
interface IMyERC20Token {
...
    function transferFrom(address from, address to, uint256 amount) external;
...
}
```

We corrected like this and the error disapeared
```
interface IMyERC20Token {
...
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
...
}
```

3. a medium severity warning regarding reentrancy vulnerabilities
```
Reentrancy in TokenLoan.unstakeTokens(uint256) (contracts/TokenLoan.sol#180-200):
	External calls:
	- placementToken.mint(address(this),fees + results.penalties) (contracts/TokenLoan.sol#191)
	- placementToken.mint(msg.sender,profits) (contracts/TokenLoan.sol#192)
	State variables written after the call(s):
	- placements[msg.sender] = Placement(startDate,remaining) (contracts/TokenLoan.sol#196-199)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-1
```

This was due to the fact that our method wrote state variables after the calls
 ```
   function unstakeTokens(uint256 _amount) external {
        require(placements[msg.sender].amount - _amount > 0);

...

        placementToken.mint(address(this), fees + results.penalties); // this is where we may earn money
        placementToken.mint(msg.sender, profits);

        placements[msg.sender] = Placement({
            startingDate: startDate,
            amount: remaining
        });

    }
```

We applied the check-effects-interactions pattern.
 ```
   function unstakeTokens(uint256 _amount) external {
        require(placements[msg.sender].amount - _amount > 0);

...

        placements[msg.sender] = Placement({
            startingDate: startDate,
            amount: remaining
        });

        placementToken.mint(address(this), fees + results.penalties); // this is where we may earn money
        placementToken.mint(msg.sender, profits);
    }
```



## Running the project [WIP]

# To deploy the contract run
```shell
yarn run ts-node --files scripts/Deployment.ts "blabla"
```

To deposit money in the contract run
```shell
yarn run ts-node --files scripts/deposit.ts [contract_address] [wallet_address] [amount]
```

