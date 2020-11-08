wakfu-autobuild
======================

[![Build Status](https://travis-ci.com/eight04/wakfu-autobuild.svg?branch=master)](https://travis-ci.com/eight04/wakfu-autobuild)
[![codecov](https://codecov.io/gh/eight04/wakfu-autobuild/branch/master/graph/badge.svg)](https://codecov.io/gh/eight04/wakfu-autobuild)
[![install size](https://packagephobia.now.sh/badge?p=wakfu-autobuild)](https://packagephobia.now.sh/result?p=wakfu-autobuild)

A CLI tool that can find the equipment combination with the highest damage factor.

![screenshot](https://i.imgur.com/g56lgHz.png)

Install
-------

```
npm install -g wakfu-autobuild
```

Usage
-----
<!--$inline.start("cmd:node cli -h|trim|markdown:codeblock")-->
```
Usage:
  wakfu-autobuild [options]

Options:
  --level=<number>                  character level. [default: 1]
  --min-level=<number>              minimum item level. [default: 1]
  --element=<number>                number of elements that the character uses. [default: 1]
  
  --require=<constrains>            a comma separated constrain list. Each constrain is composed by a property name,
                                    the "=" symbol, and a value. Example: "ap=5,control=3"
              
  --base-ap=<number>                base ap. [default: 6]
  --base-mastery=<number>           base mastery given by passive or buff. [default: 0]
  --base-critical-hit=<number>      base critical hit % given by passive or buff. [default: 0]
  --base-critical-mastery=<number>  base critical mastery given by passive or buff. [default: 0]
  --base-damage-inflicted=<number>  base damage inflicted %. [default: 0]
  
  --second-mastery=<masteries>      a comma separated secondary mastery list. Example: "singleTarget,melee".
  
  --major=<number>                  calculate major points. [default: 0]
  
  --disable-category=<types>        a comma separated category list. Example: "costume,accessory"
  --disable-item=<ids>              a comma separated list of item id. Example: "24674,22609"
  --use-item=<ids>                  a comma separated list of item id. Example: "26581,17543"
  
  --ap-to-damage                    calculate ap as a damage modifier.
  --range-to-damage                 calculate range as a damage modifier. This adds 3 damage inflicted for each
                                    range.
                                    
  --score-only                      do not search for items but only calculate the score of the current stat given
                                    by --base-xxx options.
```
<!--$inline.end-->

Details:

* Equipment whose level is lower `--min-level` and higher `--level` are excluded. It doesn't calculate kit skill.

* `--element` decides how to calculate elemental mastery. Suppose an equipment gives 100 mastery in two elements. The tool adds 100 mastery for single-element character and adds 100 * 2 / 3 mastery for tri-element character.

* `--ap-to-damage` calculates AP as a damage modifier since you can cast more spells with more AP. However this is not strictly true because some spells have cooldown and can't be used multiple times in one turn.

* `--major` option treats major points as items and find the best combination with other equipment. You get one major point at level 25, 75, 125, and 175.

  If you want to exclude/use specific majors, target them with id 1~7.

* Available options for `--require`:

    <!--$inline.start("cmd:node get-single-value-effect|trim|markdown:codeblock,js|indent")>-->
    ```js
    [
      'hp',                 'criticalHit',
      'control',            'dodge',
      'block',              'initiative',
      'lock',               'healingMastery',
      'meleeMastery',       'singleTargetMastery',
      'wisdom',             'kitSkill',
      'ap',                 'distanceMastery',
      'rearMastery',        'prospecting',
      'areaMastery',        'criticalMastery',
      'mp',                 'rearResistance',
      'criticalResistance', 'range',
      'berserkMastery',     'wp',
      'forceOfWill'
    ]
    ```
    <!--$inline.end-->

* Available options for `--second-mastery`:
    <!--$inline.start("cmd:node get-second-mastery|trim|markdown:codeblock,js|indent")-->
    ```js
    [
      'healing',
      'melee',
      'singleTarget',
      'distance',
      'rear',
      'area',
      'berserk'
    ]
    ```
    <!--$inline.end-->
  
* Available options for `--disable-category`:
    <!--$inline.start("cmd:node get-category|trim|markdown:codeblock,js|indent")-->
    ```js
    [
      'neck',        'ring',
      'legs',        'back',
      'belt',        'head',
      'heavyWeapon', 'firstWeapon',
      'shoulders',   'secondWeapon',
      'accessory',   'chest',
      'pet',         'costume'
    ]
    ```
    <!--$inline.end-->
    
Examples
--------

*Find some equipments for 12ap, lv.155, AoE, fire/earth Cra*

```
wakfu-autobuild --level 155 --element 2 --require control=2,ap=5 --base-mastery 334 --base-critical-hit 33 --base-critical-mastery 208 --base-damage-inflicted 44 --second-mastery distance,area --disable-category accessory --range-to-damage
```

*Find some equipments for lv.140 Astrub Knight*

```
wakfu-autobuild --level 140 --element 1 --require mp=2 --base-mastery 301 --base-critical-hit 11  --second-mastery singleTarget,melee --disable-category accessory --ap-to-damage
```

*Calculate the score of autobuild for lv.166 pandora*

```
wakfu-autobuild --base-ap 12 --base-mastery 1148 --base-critical-hit 38 --ap-to-damage --score-only
```

Issues
------

1. Wakfu didn't provide useful information about pets and mounts. Please provide these extra mastery/critical via `--base-mastery`/`--base-critical-hit`/`--base-critical-mastery` options.

2. Static elemental mastery might not work correctly. To simplify the process e.g. "15 water mastery" will be converted to "15 mastery of 1 element".

3. Some classes get extra damage with specific stat e.g. Cra gains 3% damage inflicted for each `range`. Currently they are hand-crafted. Please raise feature requests to add more for other classes.

4. Set effects are not included. This affects the search result for low level items (and PvP items?).

Changelog
---------

* 0.4.0 (Jul 23, 2020)

  - Fix: dfs the final result to avoid memory overflow.
  - Breaking: drop --pool-size option.

* 0.3.0 (Jul 13, 2020)

  - Fix: solve negative effects correctly.
  - Add: `--major` option.
  - Add: `--disable-item` and `--use-item` options.
  - Add: `--score-only` option.
  - Add: `--pool-size` option. Improve performance.
  - **Breaking: decrease default ap from 7 to 6. This affects the final score.**
  - Breaking: exclude costume.

* 0.2.0 (Jun 7, 2020)

  - Rewrite the solver, improve performance.
  - Display alternative item in the result.

* 0.1.0 (Jun 6, 2020)

  - Initial release.
