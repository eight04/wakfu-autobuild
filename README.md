wakfu-autobuild
======================

[![Build Status](https://travis-ci.com/eight04/wakfu-autobuild.svg?branch=master)](https://travis-ci.com/eight04/wakfu-autobuild)
[![codecov](https://codecov.io/gh/eight04/wakfu-autobuild/branch/master/graph/badge.svg)](https://codecov.io/gh/eight04/wakfu-autobuild)
[![install size](https://packagephobia.now.sh/badge?p=wakfu-autobuild)](https://packagephobia.now.sh/result?p=wakfu-autobuild)

A CLI tool that can find the equipment combination with the highest damage factor.

![screenshot](https://i.imgur.com/0zWeZ1t.png)

Install
-------

```
npm install -g wakfu-autobuild
```

Usage
-----

```
Usage:
  wakfu-autobuild [options]

Options:
  --level=<number>                  character level. [default: 1]
  --element=<number>                number of elements that the character uses. [default: 1]
  
  --require=<constrains>            a comma separated constrain list. Each constrain is composed by a property name,
                                    the "=" symbol, and a value. Example: "ap=5,control=3"
              
  --base-mastery=<number>           base mastery given by passive or buff. [default: 0]
  --base-critical-hit=<number>      base critical hit % given by passive or buff. [default: 0]
  --base-critical-mastery=<number>  base critical mastery given by passive or buff. [default: 0]
  
  --second-mastery=<masteries>      a comma separated secondary mastery list. Example: "singleTarget,melee".

```

Details:

* Equipments whose level > `--level` are excluded. It doesn't calculate kit skill.

* `--element` decide how it calculates elemental mastery. Suppose an equipment gives 100 mastery in two elements, the tool adds 100 mastery for single-mastery character and adds 100 * 2 / 3 mastery for tri-mastery character.

* `--ap-to-damage` calculates AP as a damage modifier since usually you can cast more spells with more AP. However this is not strictly true because some spells have cooldown and can't be used multiple times in one turn.

Issues
------

1. Wakfu didn't provide detailed information about pets and mounts. Please provide these extra mastery/critical via `--base-mastery`/`--base-critical-hit`/`--base-critical-mastery` options.

2. Static element mastery might not work correctly. To simplify the process e.g. "15 water mastery" will be converted to "15 mastery of 1 element".

3. Some classes get extra damage with specific stat e.g. Cra gains 3% damage inflicted for each `range`. Currently they are hand-crafted. Please raise feature requests to add more.

Changelog
---------

* 0.1.0 (Next)

  - Initial release.
