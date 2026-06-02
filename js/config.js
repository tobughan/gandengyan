const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const RANK_VALUES = {3:0,4:1,5:2,6:3,7:4,8:5,9:6,10:7,J:8,Q:9,K:10,A:11,2:12};
const SUITS = [
  {name:'spade',symbol:'\u2660',color:'black'},
  {name:'heart',symbol:'\u2665',color:'red'},
  {name:'club',symbol:'\u2663',color:'black'},
  {name:'diamond',symbol:'\u2666',color:'red'}
];
const WILD_NAMES = ['SmallJoker','BigJoker','Tingyong'];
const WILD_DISPLAY = {SmallJoker:'\u5c0f\u738b',BigJoker:'\u5927\u738b',Tingyong:'\u542c'};
const WILD_ORDER = ['BigJoker','SmallJoker','Tingyong'];
const PLAYER_COUNTS = [3,4,5];
const HAND_SIZE_DEALER = 6;
const HAND_SIZE_PLAYER = 5;
