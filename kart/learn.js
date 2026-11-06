/* =====================================================================================================
   FOXKARTS · the English part
   Built from the research note "Foxino Kart - Learning Research" (Obsidian vault, fugio.co/AI Games):
   - three kinds of question: WORD (a picture + a word: read-the-word-and-tap-the-picture, or see-the-picture-and-pick-the-word;
     no listen-only cards since v40: the word is always written, the voice only helps),
     GAP (a sentence with a missing word) and REPLY (pick the right answer to a question);
   - every wrong option has a short Czech hint ("why"), shown after a mistake;
   - every item is read aloud (the phone's English voice);
   - spaced repetition: each item sits in a Leitner box 0–5; right = up a box, wrong = back to box 0.
     Box 0 comes back later in the same race, box 1 next race, 2 next day, 3 after 3 days, 4 after 7, 5 after 21;
   - the level adapts: aim for about 80% right (step up above 90%, down below 65% over the last 20 answers).
   Levels: 0 = Starter (one written word, tap its picture), 1 = A1, 2 = A2.
   ===================================================================================================== */

// WORDS: [word, emoji picture, Czech, category, level]. Categories decide which track a word belongs to.
const WORDS = [
  // Alps: winter, clothes, animals, weather
  ['snow', '❄️', 'sníh', 'winter', 0], ['snowman', '⛄', 'sněhulák', 'winter', 0], ['skis', '🎿', 'lyže', 'winter', 1], ['mountain', '🏔️', 'hora', 'winter', 0],
  ['tree', '🌲', 'strom', 'winter', 0], ['house', '🏠', 'dům', 'winter', 0], ['sledge', '🛷', 'sáně', 'winter', 1],
  ['scarf', '🧣', 'šála', 'clothes', 1], ['gloves', '🧤', 'rukavice', 'clothes', 1], ['coat', '🧥', 'kabát', 'clothes', 1], ['boots', '🥾', 'boty', 'clothes', 1],
  ['cap', '🧢', 'kšiltovka', 'clothes', 1], ['socks', '🧦', 'ponožky', 'clothes', 1],
  ['fox', '🦊', 'liška', 'animals', 0], ['rabbit', '🐰', 'králík', 'animals', 0], ['bear', '🐻', 'medvěd', 'animals', 0], ['deer', '🦌', 'jelen', 'animals', 1],
  ['cow', '🐄', 'kráva', 'animals', 0], ['sheep', '🐑', 'ovce', 'animals', 0], ['owl', '🦉', 'sova', 'animals', 1], ['penguin', '🐧', 'tučňák', 'animals', 0], ['dog', '🐶', 'pes', 'animals', 0],
  ['sun', '☀️', 'slunce', 'weather', 0], ['cloud', '☁️', 'mrak', 'weather', 0], ['rain', '🌧️', 'déšť', 'weather', 1], ['wind', '🌬️', 'vítr', 'weather', 1],
  // Robo City: town, transport, jobs, things
  ['car', '🚗', 'auto', 'transport', 0], ['bus', '🚌', 'autobus', 'transport', 0], ['train', '🚆', 'vlak', 'transport', 0], ['bike', '🚲', 'kolo', 'transport', 0],
  ['plane', '✈️', 'letadlo', 'transport', 0], ['boat', '⛵', 'loď', 'transport', 0], ['taxi', '🚕', 'taxi', 'transport', 1],
  ['school', '🏫', 'škola', 'town', 1], ['hospital', '🏥', 'nemocnice', 'town', 1], ['shop', '🏪', 'obchod', 'town', 1], ['bank', '🏦', 'banka', 'town', 1],
  ['bridge', '🌉', 'most', 'town', 1], ['traffic lights', '🚦', 'semafor', 'town', 1], ['park', '🌳', 'park', 'town', 1],
  ['doctor', '🧑‍⚕️', 'lékař', 'jobs', 1], ['teacher', '🧑‍🏫', 'učitel', 'jobs', 1], ['police officer', '👮', 'policista', 'jobs', 2], ['firefighter', '🧑‍🚒', 'hasič', 'jobs', 2], ['cook', '🧑‍🍳', 'kuchař', 'jobs', 1],
  ['left', '⬅️', 'vlevo', 'directions', 0], ['right', '➡️', 'vpravo', 'directions', 0], ['straight on', '⬆️', 'rovně', 'directions', 1],
  ['robot', '🤖', 'robot', 'things', 0], ['phone', '📱', 'telefon', 'things', 0], ['computer', '💻', 'počítač', 'things', 1], ['clock', '⏰', 'hodiny', 'things', 1], ['key', '🔑', 'klíč', 'things', 1], ['light bulb', '💡', 'žárovka', 'things', 2],
  // Star Loop: space, colours, numbers
  ['planet', '🪐', 'planeta', 'space', 0], ['star', '⭐', 'hvězda', 'space', 0], ['moon', '🌙', 'měsíc', 'space', 0], ['rocket', '🚀', 'raketa', 'space', 0],
  ['astronaut', '🧑‍🚀', 'astronaut', 'space', 1], ['alien', '👽', 'mimozemšťan', 'space', 0], ['Earth', '🌍', 'Země', 'space', 1], ['telescope', '🔭', 'dalekohled', 'space', 2],
  ['comet', '☄️', 'kometa', 'space', 2], ['satellite', '🛰️', 'družice', 'space', 2],
  ['red', '🔴', 'červená', 'colours', 0], ['blue', '🔵', 'modrá', 'colours', 0], ['green', '🟢', 'zelená', 'colours', 0], ['yellow', '🟡', 'žlutá', 'colours', 0],
  ['orange', '🟠', 'oranžová', 'colours', 0], ['purple', '🟣', 'fialová', 'colours', 0], ['black', '⚫', 'černá', 'colours', 0], ['white', '⚪', 'bílá', 'colours', 0], ['brown', '🟤', 'hnědá', 'colours', 1],
  ['one', '1️⃣', 'jedna', 'numbers', 0], ['two', '2️⃣', 'dva', 'numbers', 0], ['three', '3️⃣', 'tři', 'numbers', 0], ['four', '4️⃣', 'čtyři', 'numbers', 0], ['five', '5️⃣', 'pět', 'numbers', 0],
  ['six', '6️⃣', 'šest', 'numbers', 0], ['seven', '7️⃣', 'sedm', 'numbers', 0], ['eight', '8️⃣', 'osm', 'numbers', 0], ['nine', '9️⃣', 'devět', 'numbers', 0], ['ten', '🔟', 'deset', 'numbers', 0],
];
const TRACK_CATS = { alps: ['winter', 'clothes', 'animals', 'weather'], city: ['transport', 'town', 'jobs', 'things', 'directions'], space: ['space', 'colours', 'numbers'] };

// GAPS: [sentence (___ = the gap), answer, [wrong options], { wrong option: Czech hint }, level, track ('all' or a track id), picture]
const GAPS = [
  ['The cat is ___ the table.', 'on', ['in', 'at'], { in: '"in" = uvnitř. Na stole = on the table.', at: 'Na povrchu = on: on the table.' }, 1, 'all', '🐱'],
  ['My skis are ___ the car.', 'in', ['on', 'under'], { on: 'Uvnitř auta = in the car.', under: '"under" = pod. Uvnitř = in.' }, 1, 'alps', '🎿'],
  ['I ___ ten years old.', 'am', ['is', 'are'], { is: 'S "I" vždy "am": I am.', are: '"are" je pro you/we/they. Já = I am.' }, 1, 'all'],
  ['She ___ a red hat.', 'has', ['have', 'is'], { have: 'U he/she/it: has. She has.', is: 'Mít = have/has: she has a hat.' }, 1, 'all', '👒'],
  ['We ___ in the snow every winter.', 'play', ['plays', 'playing'], { plays: 'S "we" bez -s: we play.', playing: 'Každou zimu = zvyk: we play.' }, 1, 'alps', '⛄'],
  ['He ___ hot chocolate every morning.', 'drinks', ['drink', 'drinking'], { drink: 'U he/she/it přidáváme -s: he drinks.', drinking: 'Každé ráno = zvyk: he drinks.' }, 1, 'alps', '☕'],
  ['There ___ three chalets on the hill.', 'are', ['is', 'am'], { is: 'Víc věcí = there are.', am: '"am" jen s "I". Víc věcí: there are.' }, 1, 'alps', '🏠'],
  ['There ___ a snowman in the garden.', 'is', ['are', 'be'], { are: 'Jedna věc = there is.', be: 'Správný tvar je "is": there is.' }, 1, 'alps', '⛄'],
  ['Look! It ___ snowing.', 'is', ['are', 'am'], { are: 'S "it" je "is": it is snowing.', am: '"am" jen s "I". It is.' }, 1, 'alps', '🌨️'],
  ['Yesterday we ___ to the mountains.', 'went', ['go', 'goes'], { go: 'Včera = minulý čas: go → went.', goes: 'Včera = minulý čas: we went.' }, 2, 'alps', '🏔️'],
  ['Last winter I ___ how to ski.', 'learned', ['learn', 'learns'], { learn: 'Minulá zima = minulý čas: learned.', learns: 'Minulý čas: I learned.' }, 2, 'alps', '🎿'],
  ['Can you ___ fast?', 'run', ['runs', 'running'], { runs: 'Po "can" je základní tvar: can run.', running: 'Po "can" bez -ing: can run.' }, 1, 'all', '🏃'],
  ['This kart is ___ than that one.', 'faster', ['fast', 'fastest'], { fast: 'Porovnání dvou věcí: faster than.', fastest: '"fastest" = nejrychlejší. Dvě věci: faster.' }, 2, 'all', '🏎️'],
  ['Pix is the ___ racer in the team.', 'best', ['good', 'better'], { good: '"the ... in" = nejlepší: the best.', better: '"better" = lepší. Nejlepší = the best.' }, 2, 'all', '🏆'],
  ['I have ___ apple in my bag.', 'an', ['a', 'the'], { a: 'Před a, e, i, o, u: an apple.', the: 'Poprvé zmíněná věc: an apple.' }, 1, 'all', '🍎'],
  ['Rob has got ___ blue scarf.', 'a', ['an', 'some'], { an: '"an" jen před samohláskou: a blue scarf.', some: 'Jedna šála = a scarf.' }, 1, 'alps', '🧣'],
  ['The trees are ___ the chalet.', 'behind', ['between', 'over'], { between: '"between" = mezi. Za = behind.', over: '"over" = nad. Za = behind.' }, 1, 'alps', '🌲'],
  ['We have lunch ___ twelve o\'clock.', 'at', ['on', 'in'], { on: 'S hodinami: at twelve.', in: 'S hodinami: at twelve o\'clock.' }, 1, 'all', '🕛'],
  ['My birthday is ___ January.', 'in', ['on', 'at'], { on: 'S měsícem: in January.', at: 'S měsícem: in January.' }, 1, 'all', '🎂'],
  ['The race starts ___ Monday.', 'on', ['in', 'at'], { in: 'Se dnem v týdnu: on Monday.', at: 'Se dnem v týdnu: on Monday.' }, 1, 'all', '🏁'],
  ['___ you like snowballs?', 'Do', ['Does', 'Are'], { Does: 'S "you": Do you like…?', Are: '"like" je sloveso: Do you like…?' }, 1, 'alps', '❄️'],
  ['___ Gummy like ice cream?', 'Does', ['Do', 'Is'], { Do: 'U he/she/it: Does Gummy like…?', Is: '"like" je sloveso: Does Gummy like…?' }, 1, 'all', '🍦'],
  ['They ___ watching the race now.', 'are', ['is', 'am'], { is: 'S "they" je "are".', am: '"am" jen s "I". They are.' }, 1, 'all', '👀'],
  ['I don\'t ___ cold weather.', 'like', ['likes', 'liking'], { likes: 'Po "don\'t" základní tvar: like.', liking: 'Po "don\'t" bez -ing.' }, 1, 'alps', '🥶'],
  ['Stella ___ her gloves every day.', 'wears', ['wear', 'wearing'], { wear: 'U she přidáváme -s: she wears.', wearing: 'Každý den = zvyk: she wears.' }, 1, 'alps', '🧤'],
  ['Put ___ your warm coat!', 'on', ['in', 'up'], { in: 'Obléknout si = put on.', up: 'Obléknout si = put on.' }, 1, 'alps', '🧥'],
  ['The mountain is very ___.', 'high', ['highly', 'height'], { highly: 'Po "very" je přídavné jméno: high.', height: '"height" = výška. Vysoký = high.' }, 2, 'alps', '🏔️'],
  ['We must be careful ___ the ice.', 'on', ['at', 'of'], { at: 'Na ledu = on the ice.', of: 'Na ledu = on the ice.' }, 2, 'alps', '🧊'],
  ['Foxino ___ the race last year.', 'won', ['win', 'wins'], { win: 'Loni = minulý čas: win → won.', wins: 'Minulý čas: won.' }, 2, 'all', '🥇'],
  ['How ___ laps are there? Three!', 'many', ['much', 'more'], { much: 'U věcí, které počítáme: how many.', more: 'Kolik = how many.' }, 1, 'all', '🔄'],
  ['Whose kart is this? It\'s ___.', 'mine', ['my', 'me'], { my: 'Samotné "my" musí mít věc: my kart. Samo: mine.', me: 'Můj = mine.' }, 2, 'all', '🏎️'],
  ['I am ___ than my little sister.', 'taller', ['tall', 'tallest'], { tall: 'Porovnání: taller than.', tallest: 'Dvě osoby: taller.' }, 2, 'all', '📏'],
  ['It is cold. Put on your ___!', 'gloves', ['sunglasses', 'swimsuit'], { sunglasses: '"sunglasses" = sluneční brýle. Rukavice = gloves.', swimsuit: '"swimsuit" = plavky. V zimě: gloves.' }, 1, 'alps', '🧤'],
  ['A fox has got a long ___.', 'tail', ['wing', 'beak'], { wing: '"wing" = křídlo. Ocas = tail.', beak: '"beak" = zobák. Ocas = tail.' }, 1, 'alps', '🦊'],
  ['Owls can ___ at night.', 'see', ['sees', 'seeing'], { sees: 'Po "can" základní tvar: see.', seeing: 'Po "can" bez -ing: can see.' }, 1, 'alps', '🦉'],
  ['The bank is ___ the school and the park.', 'between', ['behind', 'under'], { behind: '"behind" = za. Mezi = between.', under: '"under" = pod. Mezi = between.' }, 1, 'city', '🏦'],
  ['Turn ___ at the traffic lights.', 'left', ['leaves', 'lift'], { leaves: '"leaves" = listy. Doleva = left.', lift: '"lift" = výtah. Doleva = left.' }, 1, 'city', '🚦'],
  ['A doctor works in a ___.', 'hospital', ['school', 'bank'], { school: 'Ve škole je učitel. Lékař: hospital.', bank: 'Lékař pracuje v nemocnici: hospital.' }, 1, 'city', '🧑‍⚕️'],
  ['Rob ___ a robot.', 'is', ['are', 'am'], { are: 'Rob = he, takže "is".', am: '"am" jen s "I". Rob is.' }, 1, 'city', '🤖'],
  ['There ___ many cars in the city.', 'are', ['is', 'be'], { is: 'Mnoho aut = there are.', be: 'Správný tvar je "are": there are.' }, 1, 'city', '🚗'],
  ['The bus is ___ than the bike.', 'bigger', ['big', 'biggest'], { big: 'Porovnání: bigger than.', biggest: 'Dvě věci: bigger.' }, 2, 'city', '🚌'],
  ['I go to school ___ bus.', 'by', ['on', 'with'], { on: 'Čím jedu: by bus.', with: 'Čím jedu: by bus.' }, 1, 'city', '🚌'],
  ['Robots ___ need sleep.', 'don\'t', ['doesn\'t', 'isn\'t'], { 'doesn\'t': 'Robots = they: don\'t.', 'isn\'t': '"need" je sloveso: don\'t need.' }, 2, 'city', '🤖'],
  ['What time ___ it? It\'s three o\'clock.', 'is', ['are', 'does'], { are: 'S "it" je "is": What time is it?', does: 'Kolik je hodin = What time is it?' }, 1, 'city', '⏰'],
  ['She ___ to work every day.', 'walks', ['walk', 'walking'], { walk: 'U she přidáváme -s: she walks.', walking: 'Každý den = zvyk: she walks.' }, 1, 'city', '🚶'],
  ['Where ___ the train station?', 'is', ['are', 'do'], { are: 'Jedno nádraží = is.', do: 'Kde je = Where is…?' }, 1, 'city', '🚆'],
  ['Yesterday Rob ___ a new kart.', 'built', ['build', 'builds'], { build: 'Včera = minulý čas: build → built.', builds: 'Minulý čas: built.' }, 2, 'city', '🔧'],
  ['Can I ___ your phone, please?', 'use', ['uses', 'using'], { uses: 'Po "can" základní tvar: use.', using: 'Po "can" bez -ing.' }, 1, 'city', '📱'],
  ['The robots are ___ the bridge.', 'on', ['in', 'at'], { in: 'Na mostě = on the bridge.', at: 'Na mostě = on the bridge.' }, 1, 'city', '🌉'],
  ['Mars is ___ than Earth.', 'smaller', ['small', 'smallest'], { small: 'Porovnání: smaller than.', smallest: 'Dvě věci: smaller.' }, 2, 'space', '🪐'],
  ['Jupiter is the ___ planet.', 'biggest', ['big', 'bigger'], { big: '"the … planet" = největší: biggest.', bigger: '"bigger" = větší. Největší = biggest.' }, 2, 'space', '🪐'],
  ['There ___ eight planets.', 'are', ['is', 'be'], { is: 'Víc věcí = there are.', be: 'Správný tvar je "are".' }, 1, 'space', '🪐'],
  ['The astronaut ___ to the moon last year.', 'flew', ['fly', 'flies'], { fly: 'Loni = minulý čas: fly → flew.', flies: 'Minulý čas: flew.' }, 2, 'space', '🧑‍🚀'],
  ['Look! The rocket ___ taking off!', 'is', ['are', 'does'], { are: 'Jedna raketa = is.', does: 'Právě teď = is + -ing.' }, 1, 'space', '🚀'],
  ['You can\'t breathe in space ___ there is no air.', 'because', ['but', 'so'], { but: '"but" = ale. Protože = because.', so: '"so" = takže. Protože = because.' }, 2, 'space', '🧑‍🚀'],
  ['How ___ is the moon? Very far!', 'far', ['many', 'much'], { many: 'Jak daleko = how far.', much: 'Jak daleko = how far.' }, 2, 'space', '🌙'],
  ['We ___ going to visit the stars.', 'are', ['is', 'am'], { is: 'S "we" je "are".', am: '"am" jen s "I". We are.' }, 1, 'space', '⭐'],
  ['The alien has got ___ eyes.', 'three', ['third', 'thirty'], { third: '"third" = třetí. Tři = three.', thirty: '"thirty" = třicet. Tři = three.' }, 1, 'space', '👽'],
  ['Have you ever ___ a comet?', 'seen', ['saw', 'see'], { saw: 'Po "have" je 3. tvar: seen.', see: 'Po "have you ever" je 3. tvar: seen.' }, 2, 'space', '☄️'],
  ['If you jump on the moon, you ___ very high.', 'go', ['goes', 'went'], { goes: 'S "you" bez -s: you go.', went: 'Podmínka "if" teď: you go.' }, 2, 'space', '🌙'],
  ['The rocket is ___ and white.', 'red', ['read', 'rad'], { read: '"read" = číst. Červená = red.', rad: 'Červená = red.' }, 1, 'space', '🚀'],
  // more for Robo City (town, jobs, machines, directions)
  ['The robot ___ the floor every morning.', 'cleans', ['clean', 'cleaning'], { clean: 'U he/she/it přidáváme -s: it cleans.', cleaning: 'Každé ráno = zvyk: it cleans.' }, 1, 'city', '🤖'],
  ['Go ___ and turn left at the bank.', 'straight on', ['straight off', 'straight in'], { 'straight off': 'Rovně = straight on.', 'straight in': 'Rovně = straight on.' }, 1, 'city', '⬆️'],
  ['The shop is ___ the bank.', 'opposite', ['across', 'over'], { across: 'Naproti = opposite.', over: '"over" = nad. Naproti = opposite.' }, 2, 'city', '🏪'],
  ['A firefighter ___ fires.', 'puts out', ['puts on', 'puts up'], { 'puts on': '"put on" = obléknout. Hasit = put out.', 'puts up': 'Hasit = put out.' }, 2, 'city', '🧑‍🚒'],
  ['I ___ to the park yesterday.', 'went', ['go', 'goes'], { go: 'Včera = minulý čas: go → went.', goes: 'Minulý čas: went.' }, 2, 'city', '🌳'],
  ['There ___ a bus stop near my school.', 'is', ['are', 'am'], { are: 'Jedna zastávka = there is.', am: '"am" jen s "I".' }, 1, 'city', '🚏'],
  ['Rob can ___ very fast.', 'count', ['counts', 'counting'], { counts: 'Po "can" základní tvar: can count.', counting: 'Po "can" bez -ing.' }, 1, 'city', '🔢'],
  ['Is this ___ phone? Yes, it is mine.', 'your', ['you', "you're"], { you: 'Tvůj = your.', "you're": '"you\'re" = you are. Tvůj = your.' }, 2, 'city', '📱'],
  ['The trains ___ very fast.', 'are', ['is', 'be'], { is: 'Víc vlaků = are.', be: 'Správný tvar je "are".' }, 1, 'city', '🚆'],
  ['We must stop at the ___ light.', 'red', ['read', 'rad'], { read: '"read" = číst. Červená = red.', rad: 'Červená = red.' }, 1, 'city', '🚦'],
  // more for Star Loop (space, numbers, colours, comparing)
  ['Saturn has got ___ rings.', 'big', ['bigger', 'biggest'], { bigger: '"bigger" = větší (porovnání). Velké = big.', biggest: '"biggest" = největší. Velké = big.' }, 1, 'space', '🪐'],
  ['The Sun is ___ than the Moon.', 'hotter', ['hot', 'hottest'], { hot: 'Porovnání: hotter than.', hottest: 'Dvě věci: hotter.' }, 2, 'space', '☀️'],
  ['Astronauts ___ special suits.', 'wear', ['wears', 'wearing'], { wears: 'Astronauts = they: wear.', wearing: 'Zvyk: they wear.' }, 1, 'space', '🧑‍🚀'],
  ['Three and four ___ seven.', 'is', ['are', 'am'], { are: 'U počítání: three and four is seven.', am: '"am" jen s "I".' }, 1, 'space', '🔢'],
  ['The alien ___ got green hair.', 'has', ['have', 'is'], { have: 'U he/she/it: has got.', is: 'Mít = has got.' }, 1, 'space', '👽'],
  ['Look ___ the stars!', 'at', ['on', 'in'], { on: 'Dívat se na = look at.', in: 'Dívat se na = look at.' }, 1, 'space', '⭐'],
  ['We ___ see the Moon last night.', 'could', ['can', 'cans'], { can: 'Včera = minulý čas: can → could.', cans: 'Minulý čas: could.' }, 2, 'space', '🌙'],
  ['How many legs ___ the alien got?', 'has', ['have', 'is'], { have: 'The alien = it: has … got?', is: 'Otázka s "has … got".' }, 2, 'space', '👽'],
  ['There are ___ planets near the Sun.', 'four', ['fourth', 'forty'], { fourth: '"fourth" = čtvrtý. Čtyři = four.', forty: '"forty" = čtyřicet. Čtyři = four.' }, 1, 'space', '4️⃣'],
  ['The rocket goes up ___ the sky.', 'into', ['onto', 'under'], { onto: 'Do (dovnitř) = into.', under: '"under" = pod.' }, 2, 'space', '🚀'],
];
// REPLIES: [question, right reply, [wrong replies], Czech hint, level, track]
const REPLIES = [
  ['How old are you?', 'I\'m ten.', ['I\'m fine.', 'It\'s blue.'], 'Kolik ti je let? → I\'m ten.', 2, 'all'],
  ['What\'s your name?', 'My name is Pix.', ['I\'m eight.', 'Yes, I am.'], 'Jak se jmenuješ? → My name is…', 1, 'all'],
  ['Where is the bank?', 'It\'s next to the park.', ['It\'s blue.', 'At three o\'clock.'], 'Kde to je? → It\'s next to… (vedle)', 2, 'city'],
  ['What colour is the rocket?', 'It\'s red and white.', ['It\'s fast.', 'It\'s on the moon.'], 'Jakou má barvu? → It\'s red…', 2, 'space'],
  ['Can you help me?', 'Yes, of course!', ['Yes, I am.', 'I\'m nine.'], 'Můžeš mi pomoct? → Yes, of course! (ano, jasně)', 2, 'all'],
  ['What time is it?', 'It\'s four o\'clock.', ['It\'s Monday.', 'It\'s cold.'], 'Kolik je hodin? → It\'s four o\'clock.', 2, 'city'],
  ['Do you like pizza?', 'Yes, I do.', ['Yes, I am.', 'Yes, it is.'], 'Otázka s "Do" → odpověď "Yes, I do."', 2, 'all'],
  ['Is it cold today?', 'Yes, it is.', ['Yes, I do.', 'Yes, they are.'], 'Otázka s "Is it" → "Yes, it is."', 2, 'alps'],
  ['How many planets are there?', 'There are eight.', ['It\'s big.', 'I am eight.'], 'Kolik jich je? → There are eight.', 2, 'space'],
  ['Where do you live?', 'I live in Prague.', ['I like Prague.', 'I\'m from ten.'], 'Kde bydlíš? → I live in…', 2, 'all'],
  ['What\'s the weather like?', 'It\'s snowy.', ['It\'s Tuesday.', 'I\'m happy.'], 'Jaké je počasí? → It\'s snowy / sunny…', 2, 'alps'],
  ['Who is the fastest racer?', 'Foxino is!', ['Yes, he is.', 'It\'s fast.'], 'Kdo? → odpověz jménem: Foxino is!', 2, 'all'],
  ['Are robots clever?', 'Yes, they are.', ['Yes, it is.', 'Yes, I do.'], 'Robots = they → Yes, they are.', 2, 'city'],
  ['Have you got a pet?', 'Yes, I have.', ['Yes, I am.', 'Yes, it does.'], 'Have you got…? → Yes, I have.', 2, 'all'],
  ['Where is the station?', 'Go straight on.', ['It\'s Tuesday.', 'Yes, I can.'], 'Kde je…? → ukaž cestu: Go straight on.', 2, 'city'],
  ['What do you want to be?', 'I want to be a doctor.', ['I am a doctor.', 'Yes, I want.'], 'Čím chceš být? → I want to be a…', 2, 'city'],
  ['Can robots dance?', 'Yes, they can.', ['Yes, they do.', 'Yes, it is.'], 'Can…? → Yes, they can.', 2, 'city'],
  ['Which planet is red?', 'Mars is red.', ['Red is Mars.', 'It\'s a planet.'], 'Která planeta? → Mars is red.', 2, 'space'],
  ['Are you ready?', 'Yes, I am!', ['Yes, I do!', 'Yes, it is!'], 'Are you…? → Yes, I am!', 1, 'all'],
  ['Is the Moon hot?', 'No, it isn\'t.', ['No, it doesn\'t.', 'No, I am not.'], 'Is it…? → No, it isn\'t.', 2, 'space'],
];

/* ---------- the item list ---------- */
export const ITEMS = [];
for (const [w, e, cs, cat, lv] of WORDS) ITEMS.push({ id: 'w:' + w, kind: 'word', w, e, cs, cat, lv, track: Object.keys(TRACK_CATS).find((t) => TRACK_CATS[t].includes(cat)) });
GAPS.forEach(([s, a, wrong, why, lv, track, e], i) => ITEMS.push({ id: 'g:' + i + ':' + a, kind: 'gap', s, a, wrong, why, lv, track, e }));
REPLIES.forEach(([q, a, wrong, cs, lv, track], i) => ITEMS.push({ id: 'r:' + i, kind: 'reply', q, a, wrong, cs, lv, track }));
const byId = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

/* ---------- the school curriculum packages (the same A0–A2 topics as the other Fugio games) ----------
   A teacher can choose topics in the menu. Then half of the pit-stop questions come from those topics.
   A package question looks like "text [right|wrong|wrong] (hint) text"; the first option is the right one. */
let PACK_ITEMS = [];
export function setPacks(packs, ids) {
  PACK_ITEMS = [];
  for (const p of packs || []) {
    if (!ids.includes(p.id)) continue;
    const lv = p.level === 'A0' ? 0 : p.level === 'A1' ? 1 : 2;
    (p.rounds || []).flat().forEach((q, i) => {
      const m = /^(.*?)\[([^\]]+)\](.*)$/.exec(q); if (!m) return;
      const [a, ...wrong] = m[2].split('|'); if (!wrong.length) return;
      const it = { id: `p:${p.id}:${i}`, kind: 'gap', s: `${m[1]}___${m[3]}`, a, wrong: wrong.slice(0, 2), why: {}, lv, track: 'pack', pack: p.id };
      PACK_ITEMS.push(it); byId[it.id] = it;
    });
  }
  return PACK_ITEMS.length;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- memory: Leitner boxes, history, level ---------- */
const DAY = 864e5, WAIT = [0, 60e3, DAY, 3 * DAY, 7 * DAY, 21 * DAY];   // box 1 = "next race" (a minute is enough)
let S;   // the learning part of the save: { lv, hist: [true/false…], srs: { id: { b, due, n, miss } } }
export function attach(save) { save.learn = save.learn || { lv: 1, hist: [], srs: {} }; S = save.learn; return S; }
export const level = () => S.lv;
const card = (id) => (S.srs[id] = S.srs[id] || { b: 0, due: 0, n: 0, miss: 0 });
export const known = (id) => (S.srs[id] ? S.srs[id].b >= 1 : false);
// what the question looks like for this item at this level: Starter reads one word and taps its picture; A1/A2 also
// see a picture and pick its word
export function formatFor(it) {
  if (it.kind !== 'word') return it.kind;
  if (S.lv === 0) return 'word';
  return Math.random() < (S.lv === 1 ? .5 : .35) ? 'word' : 'pic';
}
// build a question: the prompt, three options (shuffled) and the right one
export function makeQuestion(it, fmt = formatFor(it)) {
  if (it.kind === 'word') {
    // distractors: same category when the child is doing well (harder), other categories otherwise (easier)
    const hard = S.lv >= 1 && recentRate() > .8, n = S.lv === 0 ? 1 : 2;
    let pool = WORDSI.filter((x) => x.id !== it.id && (hard ? x.cat === it.cat : x.cat !== it.cat) && x.lv <= Math.max(1, S.lv));
    if (pool.length < n) pool = WORDSI.filter((x) => x.id !== it.id);
    const others = shuffle(pool.slice()).slice(0, n);
    const opts = shuffle([it, ...others]);
    return { it, fmt, opts: opts.map((o) => (fmt === 'word' ? o.e : o.w)), answer: fmt === 'word' ? it.e : it.w, say: it.w, full: it.w, cs: `${it.w} = ${it.cs}`, pic: it.e };
  }
  if (it.kind === 'gap') return { it, fmt: 'gap', opts: shuffle([it.a, ...it.wrong]), answer: it.a, say: it.s.replace('___', '…'), full: it.s.replace('___', it.a).replace(/\s*\([^)]*\)/g, ''), why: it.why, cs: it.pack ? `Správně je „${it.a}“.` : '', pic: it.e };
  return { it, fmt: 'reply', opts: shuffle([it.a, ...it.wrong]), answer: it.a, say: it.q, full: `${it.q} — ${it.a}`, cs: it.cs };
}
const WORDSI = ITEMS.filter((x) => x.kind === 'word');
const recentRate = () => (S.hist.length < 5 ? .8 : S.hist.filter(Boolean).length / S.hist.length);
// record an answer: move the item between boxes, keep the last 20 answers, and adapt the level
export function record(it, ok, raceQueue) {
  const c = card(it.id); c.n++;
  if (ok) { c.b = Math.min(5, c.b + 1); c.due = Date.now() + WAIT[c.b]; }
  else { c.b = 0; c.miss++; c.due = 0; if (raceQueue && !raceQueue.includes(it.id)) raceQueue.push(it.id); }
  S.hist.push(!!ok); if (S.hist.length > 20) S.hist.shift();
  let change = 0;
  if (S.hist.length >= 12) {
    const r = recentRate();
    if (r > .9 && S.lv < 2) { S.lv++; change = 1; S.hist = []; }
    else if (r < .65 && S.lv > 0) { S.lv--; change = -1; S.hist = []; }
  }
  return change;
}
// items this child can get at this level (Starter: only words)
const allowed = (it) => it.lv <= Math.max(S.lv, it.kind === 'word' ? 1 : 0) && (S.lv > 0 || it.kind === 'word') && (S.lv === 2 || it.kind !== 'reply');
/* pick the questions for a pit stop. About 50% the track's own items, 30% reviews that are due, 20% older items from
   other tracks. Items missed earlier in this race come back first (at least 2 questions later). */
export function pickPit(track, n, race) {
  const out = [], now = Date.now(), used = new Set(race.asked.slice(-6));
  while (out.length < n) {
    let it = null;
    const back = race.queue.find((id) => race.asked.length - (race.askedAt[id] ?? -9) >= 2 && !out.some((o) => o.id === id));
    if (back) { it = byId[back]; race.queue.splice(race.queue.indexOf(back), 1); }
    if (!it && PACK_ITEMS.length && Math.random() < .5) {
      const fresh = PACK_ITEMS.filter((x) => !used.has(x.id) && !out.includes(x) && !(S.srs[x.id] && S.srs[x.id].b >= 3));
      const due = PACK_ITEMS.filter((x) => S.srs[x.id] && S.srs[x.id].b >= 1 && S.srs[x.id].due <= now);
      const pool = due.length && Math.random() < .35 ? due : fresh.length ? fresh : PACK_ITEMS;
      it = pick(pool);
    }
    if (!it) {
      const ok = (x) => allowed(x) && !used.has(x.id) && !out.includes(x);
      const due = ITEMS.filter((x) => ok(x) && S.srs[x.id] && S.srs[x.id].b >= 1 && S.srs[x.id].due <= now);
      const own = ITEMS.filter((x) => ok(x) && (x.track === track || (x.track === 'all' && Math.random() < .5)) && !(S.srs[x.id] && S.srs[x.id].b >= 3));
      const other = ITEMS.filter((x) => ok(x) && x.track !== track && S.srs[x.id]);
      const r = Math.random(), pools = r < .3 ? [due, own, other] : r < .5 ? [other, own, due] : [own, due, other];
      const pool = pools.find((p) => p.length) || ITEMS.filter(ok);
      // new words come in small themed sets: prefer items already seen, then new ones from one category
      const seen = pool.filter((x) => S.srs[x.id]), fresh = pool.filter((x) => !S.srs[x.id]);
      it = seen.length && Math.random() < .5 ? pick(seen) : pick(fresh.length ? fresh : pool);
    }
    out.push(it);
  }
  return out;
}
// new words to teach before a race: up to n never-seen words from one of the track's categories (a small themed set)
export function newWords(track, n = 3) {
  const cats = shuffle((TRACK_CATS[track] || []).slice());
  for (const c of cats) { const fresh = WORDSI.filter((x) => x.cat === c && !S.srs[x.id] && x.lv <= Math.max(1, S.lv)); if (fresh.length) return shuffle(fresh).slice(0, n); }
  return [];
}
// a word for an answer gate: only words the child already knows (review, not teaching); colours/numbers to start with
export function pickGate(track) {
  // in Robo City some gates are about directions: the arches always show ⬅️ ⬆️ ➡️ in their own lanes
  if (track === 'city' && Math.random() < .35) { const dirs = ['left', 'straight on', 'right'].map((w) => WORDSI.find((x) => x.w === w)); return { it: pick(S.lv === 0 ? [dirs[0], dirs[2]] : dirs), opts: dirs, fixed: true }; }
  const words = WORDSI.filter((x) => known(x.id));
  const own = words.filter((x) => x.track === track);
  const pool = own.length >= 2 ? own : words.length >= 3 ? words : WORDSI.filter((x) => x.cat === 'colours' || x.cat === 'numbers');
  const it = pick(pool), n = S.lv === 0 ? 2 : 3;
  const others = shuffle(WORDSI.filter((x) => x.id !== it.id && x.cat !== it.cat && x.lv === 0)).slice(0, n - 1);
  return { it, opts: shuffle([it, ...others]) };
}
// review mode for the flash-card quizzes: due items first, then the current track's items
export function pickReview(track) {
  const now = Date.now(), due = ITEMS.concat(PACK_ITEMS).filter((x) => (x.track === 'pack' || allowed(x)) && S.srs[x.id] && S.srs[x.id].due <= now);
  if (PACK_ITEMS.length && Math.random() < .4) return pick(PACK_ITEMS);
  if (due.length && Math.random() < .7) return pick(due);
  const own = ITEMS.filter((x) => allowed(x) && (x.track === track || x.track === 'all'));
  return pick(own.length ? own : ITEMS.filter(allowed));
}
// for teachers: the items missed most often (with their text), for the Word Book report
export function tricky(n = 6) {
  return Object.entries(S.srs).filter(([, c]) => c.miss > 0).sort((a, b) => b[1].miss - a[1].miss || a[1].b - b[1].b).slice(0, n)
    .map(([id, c]) => { const it = byId[id]; if (!it) return null; return { text: it.kind === 'word' ? `${it.e} ${it.w}` : it.kind === 'gap' ? it.s.replace('___', `[${it.a}]`) : `${it.q} → ${it.a}`, miss: c.miss, n: c.n, box: c.b }; }).filter(Boolean);
}
export const stats = () => { const v = Object.values(S.srs); return { seen: v.length, mastered: v.filter((c) => c.b >= 5).length, learning: v.filter((c) => c.b >= 1 && c.b < 5).length }; };
export const LEVEL_NAMES = ['Starter', 'A1', 'A2'];

/* ---------- the voice: the phone's English voice (British if there is one), a little slow ---------- */
let voice = null;
function findVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
  const pref = ['Daniel', 'Serena', 'Kate', 'Martha', 'Arthur', 'Google UK English Female', 'Google UK English Male'];
  return vs.find((v) => pref.some((p) => v.name.includes(p)) && v.lang.startsWith('en')) || vs.find((v) => v.lang === 'en-GB') || vs.find((v) => v.lang.startsWith('en'));
}

/* (v225, the user) the voice was removed from the game: say() and the rest are kept as no-ops so nothing breaks */
export let voiceOn = false;
export function setVoice() { voiceOn = false; stopVoice(); }
/* ---------- recorded audio: every word, sentence and game phrase recorded with a British voice (audio/*.m4a,
   made with macOS "Daniel"), so it sounds the same on every phone. Anything not recorded (e.g. the curriculum
   packages) falls back to the phone's own voice. ---------- */
let AUDIO = null, actx = null, token = 0, current = null;
const bufs = new Map();
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();

export function setAudio(ctx) { actx = ctx; }
function clip(text) {
  if (!AUDIO || !actx) return Promise.resolve(null);
  const f = typeof text === 'object' ? AUDIO['cs:' + text.cs] : AUDIO[norm(text)]; if (!f) return Promise.resolve(null);
  if (!bufs.has(f)) bufs.set(f, fetch(`audio/${f}.m4a`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => new Promise((ok, no) => actx.decodeAudioData(b, ok, no))).catch(() => null));
  return bufs.get(f);
}
// split "Yes! sheep!" into recorded pieces when the whole thing isn't recorded but every piece is
function pieces(t) {
  if (typeof t === 'object') return [t];   // a Czech word: { cs: 'ovce' }
  if (!AUDIO || AUDIO[norm(t)]) return [t];
  const ps = t.replace(/([!?.])\s+/g, '$1\u0001').split('\u0001').filter((x) => x.trim());
  return ps.every((x) => AUDIO[norm(x)]) ? ps : [t];
}
export function prefetch(texts) { return;  for (const t of texts) if (t) for (const p of pieces(t)) clip(p); }
function stopVoice() { if (current) { try { current.stop(); } catch (e) {} current = null; } if ('speechSynthesis' in window) speechSynthesis.cancel(); }
function tts(p, rate, done) {
  if (!('speechSynthesis' in window)) { done(); return; }
  if (typeof p === 'object') {   // Czech, with the phone's Czech voice if it has one
    const u = new SpeechSynthesisUtterance(p.cs); u.lang = 'cs-CZ'; const cz = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('cs')); if (cz) u.voice = cz; u.rate = .95; u.onend = done; u.onerror = done; speechSynthesis.speak(u); return;
  }
  if (!voice) voice = findVoice();
  const u = new SpeechSynthesisUtterance(p); u.lang = 'en-GB'; if (voice) u.voice = voice; u.rate = rate; u.pitch = 1.05; u.onend = done; u.onerror = done;
  speechSynthesis.speak(u);
}
// say one or more pieces of English; a null piece is a short "beep" for the gap in a sentence
export function say(parts, rate = .9) {
  return;
  const my = ++token; stopVoice();
  const list = (Array.isArray(parts) ? parts : [parts]).flatMap((p) => (p === null ? [null] : pieces(p)));
  let i = 0;
  const next = async () => {
    if (my !== token || i >= list.length) return;
    const p = list[i++];
    if (p === null) { if (sayBeep) sayBeep(); setTimeout(next, 380); return; }
    const buf = await clip(p);
    if (my !== token) return;
    if (buf) { const src = actx.createBufferSource(); src.buffer = buf; src.connect(actx.destination); src.onended = () => { if (current === src) current = null; setTimeout(next, 70); }; current = src; src.start(); }
    else tts(p, rate, next);
  };
  next();
}
// iPhones only let a page speak after a tap: speak a silent word on the first tap to unlock the voice
export function unlock() { return; try { if (!('speechSynthesis' in window)) return; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
let sayBeep = null;
export function onBeep(fn) { sayBeep = fn; }
// a gap-fill sentence read aloud with a beep where the gap is
const gapParts = (s) => { s = s.replace(/\([^)]*\)/g, '').replace(/—/g, ''); const [a, b] = s.split('___'); return [a.trim() || null, null, (b || '').trim()].filter((x, i) => (x !== null && x !== '') || i === 1); };
export const sayGap = (s) => say(gapParts(s));
// fetch a question's recordings before they are needed
export function prefetchQ(q) { prefetch(q.fmt === 'gap' ? gapParts(q.it.s).filter(Boolean).concat(q.full) : [q.say, q.full]); }
