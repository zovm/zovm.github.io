(() => {
  'use strict';
  const poems = {
    '360500': {lines:['稚杉绕麓千旗卷，','野水涵空一鉴开。'],author:'朱熹',work:'新喻西境',source:'https://www.shidianguji.com/zh/mingju/7624425627111047208'},
    '360100': {lines:['落霞与孤鹜齐飞，','秋水共长天一色。'],author:'王勃',work:'滕王阁序',source:'https://gzw.nc.gov.cn/ncsgzw/gzdt/202606/ea6eab84f6054b12859b010d15bc72b1.shtml'},
    '430100': {lines:['独立寒秋，','湘江北去，','橘子洲头。'],author:'毛泽东',work:'沁园春·长沙',source:'https://m.gushiwen.cn/mingju/juv_c2d019fd784c.aspx'},
    '361100': {lines:['稻花香里说丰年，','听取蛙声一片。'],author:'辛弃疾',work:'西江月·夜行黄沙道中',source:'https://paper.people.com.cn/rmrb/images/2024-09/07/06/rmrb2024090706.pdf'},
    '330800': {lines:['梅子黄时日日晴，','小溪泛尽却山行。'],author:'曾几',work:'三衢道中',source:'https://zjnews.zjol.com.cn/05zjnews/system/2009/08/23/015768290.shtml'},
    '330600': {lines:['山重水复疑无路，','柳暗花明又一村。'],author:'陆游',work:'游山西村',source:'https://zjrb.zjol.com.cn/html/2021-10/12/content_3480742.htm?div=-1'},
    '320100': {lines:['烟笼寒水月笼沙，','夜泊秦淮近酒家。'],author:'杜牧',work:'泊秦淮',source:'https://www.njqh.gov.cn/dmqh/yzqh/qhhssylx/'}
  };
  for(const poem of Object.values(poems)){Object.freeze(poem.lines);Object.freeze(poem);}
  Object.freeze(poems);
  if(typeof module!=='undefined'&&module.exports)module.exports=poems;else window.CityPoems=poems;
})();
