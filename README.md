# Stacking solution

This project demonstrates stacking solution. It comes with a smart contract, a test for that contract, and a script that deploys that contract.

## Contributors
- Engin Erdogan
- Oleg 
- Sina Fakheri


## TODO [WIP]
- Stacking functionalities  (10%APY for 1 year stacking)
- Penality fee on unstacking or early (<1 month  5% penality, 1m<x<3m 3% penality, 3m<x<6m 2% penality, 6m<x<12m 1.5% penality) 
- Quarterly Burn mechanism (5% of profits)
- 


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

