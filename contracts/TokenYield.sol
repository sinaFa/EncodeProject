// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IMyERC20Token{
    function mint(address to, uint256 amount) external;
    function burnFrom(address to, uint256 amount) external;
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external;
    function balanceOf(address account) external returns (uint256);
}

/**
 * This contains a placement
 */
struct Placement {
    /** This is the placement creation date */
    uint256 startingDate;
    /** This is the amount of staked tokens */
    uint256 amount;
}

struct Yield {
    /** 
     * This is effective interest rate calulated from 
     * (1) the ratio of the contract
     * (2) the placement duration
     */
    uint256 interests;
     /**
      * This is the penalties, depending on contract duration
      * This is in 1000th (e.g. 50 = 5%) 
      */
    uint256 penalties;
}

/**
 * This contract permits to gain interest on locked token
 * Interest are provided each 2 weeks
 */
contract TokenYield {

    uint256 public constant PERIOD_LENGTH = 2 weeks;
    uint256 public constant PERIODS_PER_YEAR = 24;

    uint256 public interestsRatio;
    uint256 public tokenPrice;
    IMyERC20Token public yieldToken;
    mapping(address => Placement) public placements;
    address owner;

    constructor(uint256 _ratio, uint256 _price, address _token){
        owner          = msg.sender;
        interestsRatio = _ratio;
        tokenPrice     = _price;
        yieldToken     = IMyERC20Token(_token);
    }

    function purchaseTokens() external payable{
        yieldToken.mint(msg.sender, msg.value / interestsRatio);
    }

    function burnTokens(uint256 amount) external {
        yieldToken.burnFrom(msg.sender,amount);
        payable(msg.sender).transfer(amount * interestsRatio);
    }

    /**
     * This stakes (locks) tokens
     * @param _amount is the amount of tokens the caller wants to stake
     */
    function stakeTokens(uint256 _amount) external {
        yieldToken.burnFrom(msg.sender,_amount);
        yieldToken.mint(owner, _amount);
        uint256 startDate = block.timestamp;
        placements[msg.sender] = Placement({startingDate: startDate, amount: _amount});
    }

   /**
     * This retreives interests and penalties from investment, according to past time
     * Interests = 0, if investement duration < PERIOD_LENGTH
     * @return yield
     */
    function getInterests() public view returns (Yield yield){

        yield = Yield(0, 0);

        require(placements[msg.sender].amount > 0);
        uint256 currentDate = block.timestamp;
        uint256 startDate   = placements[msg.sender].startingDate;
        uint256 duration    = currentDate - startDate;
        uint256 periods     = duration / PERIOD_LENGTH;

        if (periods < 12)
            yield.penalties = 15; // 1.5 % (15 / 1000)
        if (periods < 6)
            yield.penalties = 20; // 2 %   (20 / 1000)
        if (periods < 3)
            yield.penalties = 30; // 3 %   (30 / 1000)
        if (periods < 2)
            yield.penalties = 50; // 5 %   (50 / 1000)

        yield.interests = placements[msg.sender].amount * periods * interestsRatio / PERIODS_PER_YEAR;

        if (periods < 1) {
            interests = 0;
            penalties = 0;
        }
    }

   /**
     * This unstakes (unlocks) tokens
     * @param _amount is the amount of tokens the caller wants to unstake
     */
    function unstakeTokens(uint256 _amount) external {
        require(placements[msg.sender].amount - _amount > 0);

        uint256 interests, penalties = getInterests();
        yieldToken.burnFrom(owner, _amount);
        yieldToken.mint(msg.sender, _amount);
        uint256 startDate = block.timestamp;
        placements[msg.sender] = Placement({startingDate: startDate, amount: _amount});
    }


    function ownerWithdraw(uint256 tokenId) external{}

} 