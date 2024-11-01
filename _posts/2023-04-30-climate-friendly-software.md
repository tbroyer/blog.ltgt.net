---
layout: post
title: "Climate-friendly software: don't fight the wrong battle"
description: |
    What if I told you that most promoted actions about climate-friendly software are misguided?
    Here's backing data for that claim and my opinion on the low-hanging fruits.
additional_csp:
    img_src: assets.ourworldindata.org
discuss_url: https://dev.to/tbroyer/climate-friendly-software-dont-fight-the-wrong-battle-19h2/comments
cover: /image/2023/04/climate-friendly-software.png
translations:
    - lang: fr
      url: https://blog.atolcd.com/logiciel-respectueux-du-climat-bien-choisir-ses-batailles/
      title: "Logiciel respectueux du climat : bien choisir ses batailles"
---

When talking about software ecodesign, green IT, climate-friendly software, the carbon footprint of software, or however you name it,
most of the time people focus on energy efficiency and server-side code,
sometimes going to great length measuring and monitoring it.
But what if all this was misguided?

Ok, this is a bit of a bold statement, but don't get me wrong:
I'm not saying you shouldn't care about this.
Let's look at one of the most recent examples I've seen: GitHub's [ReadME Project Q&A: Slash your code's carbon footprint](https://gh.io/AAjpnus) newsletter issue.
It's good and I agree with many things in there (go read it if you haven't already),
but it talks almost exclusively about energy efficiency and server-side code,
or in other words it limits actions to the scope 2 of the [GHG Protocol](https://ghgprotocol.org/).

So let's first understand which impacts we're talking about
before I give you my opinion on the low-hanging fruits.

*Disclaimer: people regarded as experts in green IT trusted me enough to have me contribute to [a book on the subject](https://ecoconceptionweb.com/ "(French) Eco-conception web : les 115 bonnes pratiques") but I'm not myself an expert in the field.*

Note: this post is written for developers and software architects; there are other actions to lower the climate impact of the digital world that won't be covered here.

## Stepping back

Most software nowadays is client-server: whether web-based or mobile, more and more end-user software talk to servers.
This means there's a huge asymmetry in usage: even for small-scale professional software the end users generally vastly outnumber the servers.
And this implies the impacts of the individual clients need to be much lower than those of the servers.

<figure>
<img src=/image/2023/04/ghg-balance.png width=606 height=237 alt="Data table showing greenhouse gas emissions share broken down by tier and lifecycle stage; all values in user equipment line are red, other values in use phase column are orange; in the total column, user equipment is red, networks orange, and data centers green" aria-describedby=ghg-balance>
<details>
<summary>Data table</summary>
<table id=ghg-balance>
<tr><td></td><th scope=col>Manufacturing</th><th scope=col>Use</th><th scope=col>Total</th></tr>
<tr><th scope=row>User equipment</th><td>40%</td><td>26%</td><td>66%</td></tr>
<tr><th scope=row>Networks</th><td>3%</td><td>17%</td><td>19%</td></tr>
<tr><th scope=row>Data centers</th><td>1%</td><td>14%</td><td>15%</td></tr>
<tr><th scopr=row>Total</th><td>44%</td><td>56%</td><td></td></tr>
</table>
</details>
<figcaption>Greenhouse gas emissions balance (<a href="https://www.greenit.fr/wp-content/uploads/2019/11/GREENIT_EENM_etude_EN_accessible.pdf" title="The environmental footprint of the digital world">source</a>, PDF, 533 KB)</figcaption>
</figure>

What [life-cycle assessments (LCA)](https://en.wikipedia.org/wiki/Life-cycle_assessment "Wikipedia: Life-cycle assessment") for end-users' devices tell us is that manufacturing, transport and disposal summed up immensely outweighs use, ranging from 65% up to nearly 98% of the global warming potential (GWP).
Of course, this depends where the device was manufactured and where it's being used, with the use location's biggest impact being related to the carbon footprint of the electric system, as the use phase is all about charging or powering our smartphones, laptops and desktops.

<figure>
<img src=/image/2023/04/pixel-7.png width=713 height=327 alt="Bar chart of the estimated greenhouse gas (GHG) emissions for the Google Pixel 7; production is 7 times bigger than customer use, itself much bigger than transportation or recycling" aria-describedby=pixel7>
<details>
<summary>Data table</summary>
<table id=pixel7>
<caption>Estimated GHG emissions for Pixel 7 assuming three years of use: 70 kg CO₂e</caption>
<tr><th scope=col>Lifecycle phase</th><th scope=col>Emissions share</th></tr>
<tr><th scope=row>Production</th><td>84%</td></tr>
<tr><th scope=row>Transportation</th><td>3%</td></tr>
<tr><th scope=row>Customer Use</th><td>12%</td></tr>
<tr><th scope=row>Recycling</th><td>1%</td></tr>
</table>
</details>
<figcaption>Estimated Greenhouse Gas (GHG) emissions for a Google Pixel 7 (<a href="https://www.gstatic.com/gumdrop/sustainability/pixel-7-product-environmental-report.pdf" title="Pixel 7 Product Environmental Report">source</a>, PDF, 224 KB)</figcaption>
</figure>

<figure>
<img src=/image/2023/04/precision-3520.png width=572 height=297 alt="Piechart of the estimated carbon footprint for a Dell Precision 3520 broken down by lifecycle phase, with a secondary piechart breaking down the footprint of the manufacturing phase by component; manufacturing is more than 4.5 times bigger than use, itself much bigger than transportation or end of life; components with the biggest impacts are the display, twice as big as the solid state drive, followed by the power supply and mainboard" aria-describedby=precision-3520>
<details>
<summary>Data table</summary>
<table id=precision-3520>
<caption>Carbon footprint for the Dell Precision 3520, assuming four years of use</caption>
<thead>
<tr><th scope=col>Lifecycle phase</th><th scope=col>Component</th><th scope=col>Carbon footprint's share</th></tr>
</thead>
<tbody>
<tr><th scope=rowgroup rowspan=8>Manufacturing</th><th scope=row>Chassis & assembly</th><td>3.3%</td></tr>
<tr><th scope=row>Solid state drive</th><td>17.5%</td></tr>
<tr><th scope=row>Power supply</th><td>11.1%</td></tr>
<tr><th scope=row>Battery</th><td>2.3%</td></tr>
<tr><th scope=row>Mainboard and other boards</th><td>11.9%</td></tr>
<tr><th scope=row>Display</th><td>32.9%</td></tr>
<tr><th scope=row>Packaging</th><td>0.3%</td></tr>
<tr><th scope=row>Total</th><td>79.2%</td></tr>
</tbody>
<tbody>
<tr><th scope=row colspan=2>Transportation</th><td>4.4%</td></tr>
<tr><th scope=row colspan=2>Use</th><td>16.2%</td></tr>
<tr><th scope=row colspan=2>End of life</th><td>0.3%</td></tr>
</tbody>
</table>
</details>
<figcaption>Estimated carbon footprint allocation for my Dell Precision 3520, assuming 4 years of use (I've had mine for more than 5.5 years already): 304 kg CO₂e ± 68 kg CO₂e (<a href="https://i.dell.com/sites/csdocuments/CorpComm_Docs/en/carbon-footprint-precision-3520.pdf" title="Dell Precision 3520 Product Carbon Footprint">source</a>, PDF, 557 KB)</figcaption>
</figure>

I am French, working mainly for French companies with most of their users in France, so I'm ready to admit I'm biased towards a very low use phase weight compared to other regions: go explore data for your users on [Electricity Map](https://app.electricitymaps.com/map) and [Our World in Data](https://ourworldindata.org/grapher/carbon-intensity-electricity "Our World in Data: Carbon intensity of electricity, 2022").
And yet, that doesn't change the fact that the use phase has a much lower carbon footprint than all three of manufacturing, transport, and disposal as a whole.

<figure>
<a href="https://ourworldindata.org/grapher/carbon-intensity-electricity" title="Our World in Data: Carbon intensity of electricity, 2022; interactive visualization"><img src=https://assets.ourworldindata.org/grapher/exports/carbon-intensity-electricity.svg width=850 height=600 alt="Map of carbon intensity of electricity in 2022, per country; countries whose electricity consumption emits less than 100 g CO₂e per kWh are mainly in Central, Eastern, and Southern Africa, and in Europe"></a>
</figure>

What we can infer from this, is that keeping our devices longer will  increase the share of use in the whole life-cycle impacts.
Fairphone measured that extending the lifespan of their phones from 3 to 5 years <q>helps reduce the yearly emissions on global warming by 31%, while a further extension to 7 years of use helps reduce the yearly impact by 44%.</q>

<figure>
<img src=/image/2023/04/fairphone-4.png width=485 height=293 alt="Barchart of yearly emissions for the Fairphone 4, per baseline scenario" aria-describedby=fairphone-4>
<details>
<summary>Data table</summary>
<table id=fairphone-4>
<caption>Yearly emissions per baseline scenario, in kg CO₂e (numbers are approximations read from the barchart)</caption>
<tr><td></td><th scope=col>3 years</th><th scope=col>5 years</th><th scope=col>7 years</th></tr>
<tr><th scope=row>Production</th><td>11.7</td><td>7.1</td><td>5.5</td></tr>
<tr><th scope=row>Transport</th><td>0.5</td><td>0.3</td><td>0.2</td></tr>
<tr><th scope=row>Use</th><td>2.3</td><td>2.3</td><td>2.3</td></tr>
<tr><th scope=row>End of life</th><td>0.6</td><td>0.3</td><td>0.2</td></tr>
</table>
</details>
<figcaption>Fairphone 4: comparative of yearly emissions per baseline scenario (<a href="https://www.fairphone.com/wp-content/uploads/2022/07/Fairphone-4-Life-Cycle-Assessment-22.pdf" title="Life Cycle Assessment of the Fairphone 4">source</a>, PDF, 1.1 MB)</figcaption>
</figure>

{% pullquote "presentation" %}Extending the lifespan of a smartphone from 3 to 5 years can reduce its yearly global warming impacts by almost a third.{% endpullquote %}

Things are different for servers though, where the use phase's share varies much more depending on use location: from 4% up to 85%!
As noted in the ReadME Project Q&A linked above, big companies' datacenters are for the most part net-neutral in carbon emissions, so not only the geographic regions of your servers matter, but also the actual datacenters in those regions.
This implies that whatever you do on the server side, its impact will likely be limited (remember what I was saying in the introduction?)
Of course there are exceptions, and there will always be, so please look at this through the prism of your own workloads.

<figure>
<img src=/image/2023/04/dell-r640.png width=486 height=359 alt="Piechart of estimated carbon footprint allocation for a Dell PowerEdge R640, assuming 4 years of use: use is more than 4.5 times bigger than manufacturing, itself an order of magnitude bigger than transportation or end of life." aria-describedby=dell-r640>
<details>
<summary>Data table</summary>
<table id=dell-r640>
<tr><th scope=col>Lifecycle phase</th><th scope=col>Emissions share</th></tr>
<tr><th scope=row>Manifacturing</th><td>16.6%</td></tr>
<tr><th scope=row>Transportation</th><td>0.3%</td></tr>
<tr><th scope=row>Use</th><td>83%</td></tr>
<tr><th scope=row>End of life</th><td>0.1%</td></tr>
</table>
</details>
<figcaption>Estimated carbon footprint for a Dell PowerEdge R640 server, assuming 4 years of use: 7730 kg CO₂e (<a href="https://i.dell.com/sites/csdocuments/CorpComm_Docs/en/carbon-footprint-poweredge-r640.pdf" title="Dell PowerEdge R640 Product Carbon Footprint">source</a>, PDF, 514 KB)</figcaption>
</figure>

Keep in mind the orders of magnitude though: 70 kg CO₂e for a single Pixel 7 (on 3 years) vs. 7730 kg CO₂e for a Dell PowerEdge R640 server (on 4 years), that's 110 smartphones for a server (or a 83:1 ratio when considering yearly emissions): chances are that you'll have much more users than that.
The ratio for laptops (304 kg CO₂e on 4 years for a Dell Precision 3520) would be 25 laptops for a server.
But as seen previously the actual carbon footprint will vary a lot depending on the location; you can explore some data in the [Boavizta data visualization tool](https://dataviz.boavizta.org/manufacturerdata "Datavizta: Manufacturer data repository") that compiles dozens of LCAs of various manufacturers. 
The Dell PowerEdge R640 in France would actually emit 1701 kg CO₂e rather than 7730 kg CO₂e: that's a 4.5:1 ratio!
Comparatively, my Dell Precision 3520 would fall from 304 kg CO₂e to 261 kg CO₂e, only a 1.16:1 ratio.
The laptop to server ratio would thus fall from 25 down to 7.9:1, which makes the laptops' impacts comparatively much bigger than the server compared to other regions.

Note that there are three tiers: end-users, datacenters, and networks.
Network energy consumption however [doesn't vary proportionally to the amount of data transferred](https://doi.org/10.1016/j.joule.2021.05.007 "Does not compute: Avoiding pitfalls assessing the Internet's energy and carbon impacts"), which means we as users of those networks don't have much levers on their footprint.
That being said, data transmission is [among the things that will drain the batteries of mobile devices](https://developer.android.com/training/connectivity/minimize-effect-regular-updates#:~:text=Requests%20that%20your%20app%20makes%20to%20the%20network%20are%20a%20major%20cause%20of%20battery%20drain%20because%20they%20turn%20on%20power%2Dconsuming%20cellular%20or%20Wi%2DFi%20radios. "Android Developers: Requests that your app makes to the network are a major cause of battery drain because they turn on power-consuming cellular or Wi-Fi radios."), so reducing the amount of data you exchange on the network could have a more direct impact on the battery life of end-users' smartphones (even though what will drain the battery the most will more likely be the screen).

## Taking action

So, what have we learned so far?
* It's important that end users keep their devices longer,
* we can't do much about networks,
* the location (geographic region and datacenter) of servers matter a lot, more so than how and how much we use them.

Now, what can we do about it?

For servers, it's relatively simple:
if you can, rent servers in energy efficient datacenters, and/or countries with low-carbon electricity;
in addition, or otherwise, then of course optimize your server-side architecture and code.
If you manage your own servers, avoid buying machines to let them sit idle: maximize their utilization.

{% pullquote "presentation" %}Pick servers in carbon-neutral or low-carbon datacenters first, then optimize your architecture and code.{% endpullquote %}

For the networks, our actions are probably limited to reducing data usage, <q>not because it reduces immediate emissions (it doesn't), but to avoid the need for rapid expansion of the network infrastructure</q> (I'm quoting [Wim Vanderbauwhede][] here, from a private conversation).

For the end-users' devices, it's more complicated, but not out of reach:
we want users to keep their devices as long as possible so, put differently, we must not be responsible for them to change their devices.
There will always be people changing devices "for the hype" or on some scheduled basis (or just because the vendor stopped pushing security updates, [some form of planned obsolescence](https://en.wikipedia.org/wiki/Planned_obsolescence#Software_degradation_and_lock-out "Wikipedia: Planned Obsolescence: Software degradation and lock-out"), or can't be repaired; two things laws could alleviate), but there are also many people who keep them as long as possible (because they're eco-conscious or can't afford purchasing a new device, or simply because they don't feel the need for changing something that's still fully functioning.)
For those people, don't be the one to make them change their mind and cross the line.

{% pullquote "presentation" %}Don't be the one that will make your users change their device.{% endpullquote %}

This is something we won't ever be able to measure, as it depends on how people perceive the overall experience on their device, but it boils down to perceived performance.
So by all means, optimize your mobile apps and web frontends, test on old devices and slow networks (even if only emulated), and monitor their real-user performance (e.g. through [Web Vitals](https://web.dev/vitals/)).
As part of performance testing, have a look at electricity use, as it will both be directly associated with emissions to produce that electricity, and be perceptible by the user (battery drain).
And don't forget to account for the app downloads as part of the overall perceived performance: light mobile apps that don't need to be updated every other day, frontend JS and CSS that can be cached and won't update several times a day either (defeating the cache).

{% pullquote %}Optimize for the perceived performance and battery life.{% endpullquote %}

Don't forget about the space taken by your app on the user's device too: users shouldn't have to make a choice between apps due to _no space left on device_, so when possible prefer a website or progressive web app (PWA) to a native application (you can still publish them to application stores if required, through tiny wrapper native apps).

{% pullquote %}When possible, prefer a website or PWA to a native application.{% endpullquote %}

## A note to product managers

The above advices were mostly technical, answering the question <q>What can I do as an architect or developer?</q>
but product managers have their share, and they're actually the ones in power here:
they can choose which features to build or not build, they can shape the features, they can reduce software complexity by limiting the number of features and of levers and knobs.
This will undoubtedly avoid bloat and help you make things leaner and faster.

Avoid [feature creep](https://en.wikipedia.org/wiki/Feature_creep "Wikipedia: Feature creep") and beware of [Wirth's law](https://en.wikipedia.org/wiki/Wirth%27s_law "Wikipedia: Wirth's law").

{% pullquote %}Refrain from adding features, reduce software complexity.{% endpullquote %}

Last, but not least, make sure you really need software!
Sometimes you should embrace [low-tech](https://en.wikipedia.org/wiki/Low_technology "Wikipedia: Low technology").
For example, instead of developing a mobile app with accounts to identify the user so you can notify them, then maybe you could simply use SMS (assuming you have some out-of-band means of knowing their phone number, and the latency of distribution is acceptable).
And sometimes what you're trying to address with software just isn't worth it, particularly if it involves IoT (remember that we should strive for fewer devices that we keep longer, not more).

{% pullquote %}Sometimes, ideas aren't even worth their impacts.{% endpullquote %}

Conversely, as we'll need to electrify parts of our economy to reduce their carbon footprint, <q>software is one of the few sectors to start with a head-starts: we get greener at the same rate as the grid without other work needed</q> (I'm quoting [Alex Russell][] here, from a private conversation), so please do use software to digitalize and replace more carbon-intensive activities.

## Other pitfalls

Besides only evaluating electricity consumption on your servers, another pitfall is trying to attribute emissions to each user or request:
when you have dozens, hundreds or even thousands of concurrent requests, how do you distribute electricity consumption among them?
There's an [IETF proposal for a HTTP response header](https://datatracker.ietf.org/doc/draft-martin-http-carbon-emissions-scope-2/ "IETF: HTTP Response Header Field: Carbon-Emissions-Scope-2") exposing such information, and while it's a commendable idea I doubt it's realistic.
My personal belief is that display of such information is often a sign of [greenwashing](https://en.wikipedia.org/wiki/Greenwashing "Wikipedia: Greenwashing").
To my knowledge, data can only be accurate in aggregates.

If you really do want to show how _green_ you are, conduct a life-cycle assessment (LCA): take all three scopes into account, all three tiers, evaluating impacts over more criterias than the global warming potential (GWP) alone.

Here are a couple resources if you want to go farther:
* [Pitfalls to avoid when assessing the environmental footprint of digital technology](https://www.greenit.fr/2023/04/18/quels-pieges-a-eviter-pour-evaluer-lempreinte-environnementale-du-numerique/) (in French)
* [Learn Green Software](https://learn.greensoftware.foundation/)


_Thanks to [Alex Russell][] and [Wim Vanderbauwhede][] for their feedback._

[Alex Russell]: https://infrequently.org/
[Wim Vanderbauwhede]: https://limited.systems/
