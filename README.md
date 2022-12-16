# Stacking solution

This project demonstrates stacking solution. It comes with a smart contract, a test for that contract, and a script that deploys that contract.

## Contributors
- Engin Erdogan
- Oleg Lodygensky
- Sina Fakheri


## TODO [WIP]
1. end users can mint / buy ERC20
2. Stacking functionalities  (12%APY for 1 year stacking)
3. end users can freely stake up to 100%
    3.1 they must provide the amount to stake
    3.2 [V1] by default, they stake for 12 months
    3.3 [V2] they must provide the duration of stake
4. end users can unstake when they want
    4.1 Penality fee on unstacking or early (<1 month  5% penality, 1m<x<3m 3% penality, 3m<x<6m 2% penality, 6m<x<12m 1.5% penality) 
5. whenever the end users exist, they earn all completed months pourcentage
6. end users earn APY each 12 months; there is a 5% fee of the APY
7. Quarterly Burn mechanism (5% of profits)
8. end users can burn their own NOT STAKED token when they want and retreive their Eth



## Running the project [WIP]

# To deploy the contract run
```shell
yarn run ts-node --files scripts/Deployment.ts "blabla"
```

To deposit money in the contract run
```shell
yarn run ts-node --files scripts/deposit.ts [contract_address] [wallet_address] [amount]
```
...

