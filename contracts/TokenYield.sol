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

/**
 * PlacementResults is made of interests and penalties
 */
struct PlacementResults {
    /** 
     * This is effective interest, independant of any penalty, calulated from 
     * (1) the ratio of the contract
     * (2) the placement duration
     */
    uint256 interests;
     /**
      * This is the penalties ratio, depending on contract duration
      * This is in 1000th (e.g. 50 = 5%),
      * because Solidity don't have floating point type.
      */
    uint256 penaltyRatio;
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
    IMyERC20Token public placementToken;
    mapping(address => Placement) public placements;
    address owner;

    constructor(uint256 _ratio, uint256 _price, address _token){
        owner          = msg.sender;
        interestsRatio = _ratio;
        tokenPrice     = _price;
        placementToken     = IMyERC20Token(_token);
    }

    function purchaseTokens() external payable{
        placementToken.mint(msg.sender, msg.value / interestsRatio);
    }

    function burnTokens(uint256 amount) external {
        placementToken.burnFrom(msg.sender,amount);
        payable(msg.sender).transfer(amount * interestsRatio);
    }

   /**
     * This compute investment results, according to past time
     * Interests = 0, if investement duration < PERIOD_LENGTH
     * @return results
     */
    function computeResults() public view returns (PlacementResults memory results){

        results = PlacementResults(0, 0);

        require(placements[msg.sender].amount > 0);
        uint256 currentDate = block.timestamp;
        uint256 startDate   = placements[msg.sender].startingDate;
        uint256 duration    = currentDate - startDate;
        uint256 periods     = duration / PERIOD_LENGTH;

        results.penaltyRatio = 0;

        if (periods < 12)
            results.penaltyRatio = 15; // 1.5 % (15 / 1000)
        if (periods < 6)
            results.penaltyRatio = 20; // 2 %   (20 / 1000)
        if (periods < 3)
            results.penaltyRatio = 30; // 3 %   (30 / 1000)
        if (periods < 2)
            results.penaltyRatio = 50; // 5 %   (50 / 1000)

        results.interests = placements[msg.sender].amount * periods * interestsRatio / PERIODS_PER_YEAR;

        if (periods < 1)
            results.interests = 0;
    }

    /**
     * This stakes (locks) tokens
     * @param _amount is the amount of tokens the caller wants to stake
     */
    function stakeTokens(uint256 _amount) external {
        placementToken.burnFrom(msg.sender,_amount);
        placementToken.mint(owner, _amount);
        uint256 startDate = block.timestamp;
        placements[msg.sender] = Placement({startingDate: startDate, amount: _amount});
    }

   /**
     * This unstakes (unlocks) tokens.
     * This retrieves placement results, gives interests to caller and substract penalties, if any.
     * This sends penalties, if any, to this contract owner
     * @param _amount is the amount of tokens the caller wants to unstake
     */
    function unstakeTokens(uint256 _amount) external {
        require(placements[msg.sender].amount - _amount > 0);

        PlacementResults memory results = computeResults();
        uint256 penalties = results.interests * results.penaltyRatio / 1000;
        placementToken.burnFrom(owner, _amount - penalties); // this is where we may earn money
        placementToken.mint(msg.sender, _amount - penalties);
        uint256 startDate = block.timestamp;
        placements[msg.sender] = Placement({startingDate: startDate, amount: _amount});
    }


    function ownerWithdraw(uint256 tokenId) external{}

} 