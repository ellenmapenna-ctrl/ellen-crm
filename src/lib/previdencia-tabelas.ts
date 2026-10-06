// Tábua biométrica BR-EMSsb-2021 (qx = probabilidade de morte no ano, por idade 0-115), extraída
// da planilha "Gerador de estudo previdência.xlsm" (aba Auxiliar, colunas H/I) da Icatu.
// Índice do array = idade.
export const QX_MASCULINO: number[] = [
  0.0003707975, 0.000242085, 0.0002129199, 0.0001991131, 0.0001916189, 0.0001876699, 0.0001861928, 0.0001866695, 0.000189483, 0.0001961013, 0.0002091557, 0.0002325625, 0.0002699656, 0.0003236332, 0.0003935276, 0.0004763501, 0.0005678099, 0.0006615395, 0.0007515943, 0.0008328873, 0.0009020711, 0.0009569951, 0.0009976223, 0.0010248766, 0.0010403836, 0.0010472052, 0.0010481314, 0.0010457511, 0.0010428245, 0.0010417837, 0.001044681, 0.0010533364, 0.0010691129, 0.0010931419, 0.0011263791, 0.0011698651, 0.0012239656, 0.001289608, 0.0013672425, 0.0014575733, 0.0015612104, 0.0016790018, 0.0018117265, 0.0019604799, 0.0021263296, 0.0023107433, 0.0025148862, 0.0027404001, 0.0029891469, 0.0032632387, 0.0035646488, 0.0038958811, 0.004259815, 0.0046592219, 0.005097523, 0.0055782956, 0.0061056374, 0.0066842113, 0.0073184713, 0.008013604, 0.0087755365, 0.0096104779, 0.0105256892, 0.0115288397, 0.0126271357, 0.0138316328, 0.0151510872, 0.0165960639, 0.018178971, 0.0199136179, 0.0218137531, 0.023894204, 0.0261708214, 0.0286630797, 0.0313923232, 0.0343781881, 0.0376456477, 0.0412216511, 0.0451314501, 0.0494118483, 0.0540943479, 0.0592134814, 0.064808708, 0.0709234783, 0.0776062615, 0.0849002274, 0.0928587468, 0.101542411, 0.1110108185, 0.1213272006, 0.1325679496, 0.1448080296, 0.1581182712, 0.1725814942, 0.1882813864, 0.205300071, 0.2237457027, 0.2436991431, 0.2652549372, 0.2885437547, 0.3135964381, 0.3405239004, 0.3693667774, 0.4062675254, 0.4486313948, 0.4951993429, 0.5461625216, 0.6016906041, 0.6615649727, 0.7250264216, 0.7905941252, 0.855635952, 0.9153523739, 0.9629801222, 0.9912628352, 0.9996218265
];

export const QX_FEMININO: number[] = [
  0.0003545253, 0.0002256076, 0.0001953352, 0.00018014, 0.0001711131, 0.0001654968, 0.0001621639, 0.0001608317, 0.0001621559, 0.0001676263, 0.000179138, 0.0001979666, 0.0002240586, 0.0002555375, 0.0002898166, 0.0003238074, 0.000354625, 0.0003804072, 0.0004002628, 0.0004141746, 0.0004229018, 0.0004275454, 0.0004295039, 0.0004303008, 0.0004311444, 0.0004332122, 0.0004374191, 0.0004445264, 0.0004551075, 0.0004695738, 0.000488241, 0.0005112644, 0.000539028, 0.0005716513, 0.0006093606, 0.00065248, 0.0007012212, 0.000755949, 0.0008170885, 0.0008850899, 0.0009604207, 0.0010437384, 0.001135621, 0.0012368706, 0.0013483463, 0.0014708876, 0.0016056642, 0.0017536568, 0.0019163234, 0.0020948383, 0.0022907592, 0.0025058503, 0.0027417309, 0.0030007045, 0.0032849944, 0.0035968481, 0.0039388176, 0.0043144355, 0.0047266324, 0.0051783979, 0.0056748589, 0.0062190159, 0.0068166499, 0.0074716172, 0.0081906672, 0.0089797158, 0.0098449948, 0.0107955489, 0.0118386959, 0.0129839252, 0.0142412286, 0.0156207259, 0.0171349675, 0.0187982793, 0.0206242479, 0.0226288264, 0.0248314142, 0.0272495388, 0.0299051555, 0.0328239872, 0.0360314673, 0.0395550131, 0.0434281254, 0.0476853125, 0.0523680636, 0.0575149199, 0.063181791, 0.0694154581, 0.0762773546, 0.0838367079, 0.0921620481, 0.1013332766, 0.1114511145, 0.122605117, 0.1349130031, 0.1485020565, 0.1635039763, 0.1800885327, 0.1984233589, 0.2187140517, 0.2411831912, 0.2660654905, 0.2936315215, 0.3241673555, 0.3579788802, 0.3954921207, 0.4369781903, 0.4828689008, 0.533396625, 0.588770321, 0.651327613, 0.7366778976, 0.8282022535, 0.9165748019, 0.9809465143, 0.9998161972
];

// Tabela de contribuições puras de risco por idade (aba "risco" da planilha), idades 18-64.
// rendaInvalidez/peculioMorte/peculioInvalidez: taxa por R$1.000 (renda) ou R$100.000 (pecúlio) de cobertura.
// pensaoPC1/5/10/15/20: taxa por R$1.000 de renda mensal de pensão por prazo certo, conforme o prazo escolhido.
export interface LinhaRisco {
  idade: number;
  rendaInvalidez: number;
  peculioMorte: number;
  peculioInvalidez: number;
  pensaoPC1: number;
  pensaoPC5: number;
  pensaoPC10: number;
  pensaoPC15: number;
  pensaoPC20: number;
}

export const TABELA_RISCO: LinhaRisco[] = [
  { idade: 18, rendaInvalidez: 17.65, peculioMorte: 8.99047618, peculioInvalidez: 13.571429, pensaoPC1: 0.97771429, pensaoPC5: 5.13159666, pensaoPC10: 9.77944186, pensaoPC15: 13.98913846, pensaoPC20: 17.80199037 },
  { idade: 19, rendaInvalidez: 17.48, peculioMorte: 9.2952381, peculioInvalidez: 13.542857, pensaoPC1: 1.01085714, pensaoPC5: 5.30554909, pensaoPC10: 10.11094837, pensaoPC15: 14.46334655, pensaoPC20: 18.40544767 },
  { idade: 20, rendaInvalidez: 17.33, peculioMorte: 9.61904761, peculioInvalidez: 13.542857, pensaoPC1: 1.04607143, pensaoPC5: 5.49037355, pensaoPC10: 10.46317403, pensaoPC15: 14.96719263, pensaoPC20: 19.04662105 },
  { idade: 21, rendaInvalidez: 17.17, peculioMorte: 10, peculioInvalidez: 13.542857, pensaoPC1: 1.0875, pensaoPC5: 5.70781408, pensaoPC10: 10.87755716, pensaoPC15: 15.55995274, pensaoPC20: 19.80094268 },
  { idade: 22, rendaInvalidez: 17.01, peculioMorte: 10.4, peculioInvalidez: 13.542857, pensaoPC1: 1.131, pensaoPC5: 5.93612665, pensaoPC10: 11.31265944, pensaoPC15: 16.18235085, pensaoPC20: 20.59298039 },
  { idade: 23, rendaInvalidez: 16.88, peculioMorte: 10.85714286, peculioInvalidez: 13.571429, pensaoPC1: 1.18071429, pensaoPC5: 6.19705529, pensaoPC10: 11.8099192, pensaoPC15: 16.89366297, pensaoPC20: 21.49816634 },
  { idade: 24, rendaInvalidez: 16.77, peculioMorte: 11.35238096, peculioInvalidez: 13.628571, pensaoPC1: 1.23457143, pensaoPC5: 6.47972799, pensaoPC10: 12.34861727, pensaoPC15: 17.66425111, pensaoPC20: 22.47878445 },
  { idade: 25, rendaInvalidez: 16.69, peculioMorte: 11.84761904, peculioInvalidez: 13.685714, pensaoPC1: 1.28842857, pensaoPC5: 6.76240069, pensaoPC10: 12.88731534, pensaoPC15: 18.43483924, pensaoPC20: 23.45940256 },
  { idade: 26, rendaInvalidez: 16.63, peculioMorte: 12.38095239, peculioInvalidez: 13.8, pensaoPC1: 1.34642857, pensaoPC5: 7.06681744, pensaoPC10: 13.46745172, pensaoPC15: 19.26470339, pensaoPC20: 24.51545284 },
  { idade: 27, rendaInvalidez: 16.56, peculioMorte: 12.8952381, peculioInvalidez: 13.885714, pensaoPC1: 1.40235714, pensaoPC5: 7.36036216, pensaoPC10: 14.02686894, pensaoPC15: 20.06492953, pensaoPC20: 25.53378704 },
  { idade: 28, rendaInvalidez: 16.55, peculioMorte: 13.40952382, peculioInvalidez: 14.028571, pensaoPC1: 1.45828571, pensaoPC5: 7.65390689, pensaoPC10: 14.58628617, pensaoPC15: 20.86515567, pensaoPC20: 26.55212123 },
  { idade: 29, rendaInvalidez: 16.55, peculioMorte: 13.92380953, peculioInvalidez: 14.2, pensaoPC1: 1.51421429, pensaoPC5: 7.94745161, pensaoPC10: 15.1457034, pensaoPC15: 21.66538181, pensaoPC20: 27.57045543 },
  { idade: 30, rendaInvalidez: 16.61, peculioMorte: 14.45714286, peculioInvalidez: 14.4, pensaoPC1: 1.57221429, pensaoPC5: 8.25186836, pensaoPC10: 15.72583978, pensaoPC15: 22.49524596, pensaoPC20: 28.6265057 },
  { idade: 31, rendaInvalidez: 16.68, peculioMorte: 14.97142857, peculioInvalidez: 14.657143, pensaoPC1: 1.62814286, pensaoPC5: 8.54541309, pensaoPC10: 16.285257, pensaoPC15: 23.2954721, pensaoPC20: 29.6448399 },
  { idade: 32, rendaInvalidez: 16.82, peculioMorte: 15.5047619, peculioInvalidez: 14.942857, pensaoPC1: 1.68614286, pensaoPC5: 8.84982984, pensaoPC10: 16.86539338, pensaoPC15: 24.12533625, pensaoPC20: 30.70089017 },
  { idade: 33, rendaInvalidez: 17, peculioMorte: 16.05714286, peculioInvalidez: 15.314286, pensaoPC1: 1.74621429, pensaoPC5: 9.16511862, pensaoPC10: 17.46624892, pensaoPC15: 24.9848384, pensaoPC20: 31.79465653 },
  { idade: 34, rendaInvalidez: 17.22, peculioMorte: 16.68571429, peculioInvalidez: 15.714286, pensaoPC1: 1.81457143, pensaoPC5: 9.5238955, pensaoPC10: 18.14998109, pensaoPC15: 25.96289257, pensaoPC20: 33.03928721 },
  { idade: 35, rendaInvalidez: 17.52, peculioMorte: 17.46666667, peculioInvalidez: 16.228571, pensaoPC1: 1.8995, pensaoPC5: 9.9696486, pensaoPC10: 18.9994665, pensaoPC15: 27.17805078, pensaoPC20: 34.58564655 },
  { idade: 36, rendaInvalidez: 17.86, peculioMorte: 18.43809525, peculioInvalidez: 16.771429, pensaoPC1: 2.00514286, pensaoPC5: 10.52412197, pensaoPC10: 20.05614348, pensaoPC15: 28.68958905, pensaoPC20: 36.50916669 },
  { idade: 37, rendaInvalidez: 18.31, peculioMorte: 19.65714286, peculioInvalidez: 17.428571, pensaoPC1: 2.13771429, pensaoPC5: 11.21993169, pensaoPC10: 21.3821695, pensaoPC15: 30.58642138, pensaoPC20: 38.92299589 },
  { idade: 38, rendaInvalidez: 18.83, peculioMorte: 21.21904761, peculioInvalidez: 18.2, pensaoPC1: 2.30757143, pensaoPC5: 12.11143789, pensaoPC10: 23.08114033, pensaoPC15: 33.01673781, pensaoPC20: 42.01571456 },
  { idade: 39, rendaInvalidez: 19.44, peculioMorte: 23.16190475, peculioInvalidez: 19.085714, pensaoPC1: 2.51885714, pensaoPC5: 13.22038462, pensaoPC10: 25.19449429, pensaoPC15: 36.03981434, pensaoPC20: 45.86275485 },
  { idade: 40, rendaInvalidez: 20.17, peculioMorte: 25.54285714, peculioInvalidez: 20.085714, pensaoPC1: 2.77778571, pensaoPC5: 14.57938798, pensaoPC10: 27.78438885, pensaoPC15: 39.74456499, pensaoPC20: 50.57726501 },
  { idade: 41, rendaInvalidez: 21, peculioMorte: 28.41904761, peculioInvalidez: 21.257143, pensaoPC1: 3.09057143, pensaoPC5: 16.22106403, pensaoPC10: 30.91298148, pensaoPC15: 44.21990378, pensaoPC20: 56.27239329 },
  { idade: 42, rendaInvalidez: 21.96, peculioMorte: 31.86666667, peculioInvalidez: 22.6, pensaoPC1: 3.4655, pensaoPC5: 18.18890088, pensaoPC10: 34.66314881, pensaoPC15: 49.58438273, pensaoPC20: 63.099004 },
  { idade: 43, rendaInvalidez: 23.07, peculioMorte: 35.92380953, peculioInvalidez: 24.142857, pensaoPC1: 3.90671429, pensaoPC5: 20.5046426, pensaoPC10: 39.07632914, pensaoPC15: 55.89727784, pensaoPC20: 71.13252932 },
  { idade: 44, rendaInvalidez: 24.33, peculioMorte: 40.55238096, peculioInvalidez: 25.914286, pensaoPC1: 4.41007143, pensaoPC5: 23.14654512, pensaoPC10: 44.11108417, pensaoPC15: 63.0993131, pensaoPC20: 80.29753707 },
  { idade: 45, rendaInvalidez: 25.8, peculioMorte: 45.6952381, peculioInvalidez: 27.942857, pensaoPC1: 4.96935714, pensaoPC5: 26.08199236, pensaoPC10: 49.70525642, pensaoPC15: 71.10157451, pensaoPC20: 90.48087902 },
  { idade: 46, rendaInvalidez: 27.43, peculioMorte: 51.2952381, peculioInvalidez: 30.257143, pensaoPC1: 5.57835714, pensaoPC5: 29.27836825, pensaoPC10: 55.79668843, pensaoPC15: 79.81514805, pensaoPC20: 101.5694069 },
  { idade: 47, rendaInvalidez: 29.3, peculioMorte: 57.31428571, peculioInvalidez: 32.942857, pensaoPC1: 6.23292857, pensaoPC5: 32.71392873, pensaoPC10: 62.34394188, pensaoPC15: 89.18075769, pensaoPC20: 113.4876886 },
  { idade: 48, rendaInvalidez: 31.41, peculioMorte: 63.67619047, peculioInvalidez: 35.971429, pensaoPC1: 6.92478571, pensaoPC5: 36.34518569, pensaoPC10: 69.26414015, pensaoPC15: 99.07985144, pensaoPC20: 126.0848598 },
  { idade: 49, rendaInvalidez: 33.78, peculioMorte: 70.36190475, peculioInvalidez: 39.457143, pensaoPC1: 7.65185714, pensaoPC5: 40.1612671, pensaoPC10: 76.53656408, pensaoPC15: 109.4827913, pensaoPC20: 139.3232043 },
  { idade: 50, rendaInvalidez: 36.44, peculioMorte: 77.27619047, peculioInvalidez: 43.4, pensaoPC1: 8.40378571, pensaoPC5: 44.10781284, pensaoPC10: 84.05761788, pensaoPC15: 120.2413872, pensaoPC20: 153.0141418 },
  { idade: 51, rendaInvalidez: 39.44, peculioMorte: 84.4, peculioInvalidez: 47.942857, pensaoPC1: 9.1785, pensaoPC5: 48.17395087, pensaoPC10: 91.80658241, pensaoPC15: 131.3260011, pensaoPC20: 167.1199562 },
  { idade: 52, rendaInvalidez: 42.79, peculioMorte: 91.65714286, peculioInvalidez: 53.114286, pensaoPC1: 9.96771429, pensaoPC5: 52.3161931, pensaoPC10: 99.70058104, pensaoPC15: 142.6180811, pensaoPC20: 181.4897832 },
  { idade: 53, rendaInvalidez: 46.55, peculioMorte: 99.00952382, peculioInvalidez: 59.028571, pensaoPC1: 10.76728571, pensaoPC5: 56.51279545, pensaoPC10: 107.6981754, pensaoPC15: 154.0583511, pensaoPC20: 196.0481906 },
  { idade: 54, rendaInvalidez: 50.74, peculioMorte: 106.4952381, peculioInvalidez: 65.771429, pensaoPC1: 11.58135714, pensaoPC5: 60.78550199, pensaoPC10: 115.8408039, pensaoPC15: 165.7060872, pensaoPC20: 210.8706105 },
  { idade: 55, rendaInvalidez: 55.5, peculioMorte: 114.1714286, peculioInvalidez: 73.542857, pensaoPC1: 12.41614286, pensaoPC5: 65.16692881, pensaoPC10: 124.190624, pensaoPC15: 177.6502033, pensaoPC20: 226.0701913 },
  { idade: 56, rendaInvalidez: 60.62, peculioMorte: 122.0761905, peculioInvalidez: 82.2, pensaoPC1: 13.27578571, pensaoPC5: 69.67881994, pensaoPC10: 132.789074, pensaoPC15: 189.9499754, pensaoPC20: 241.722365 },
  { idade: 57, rendaInvalidez: 66.43, peculioMorte: 130.2666667, peculioInvalidez: 92.2, pensaoPC1: 14.1665, pensaoPC5: 74.35379148, pensaoPC10: 141.6983112, pensaoPC15: 202.6943177, pensaoPC20: 257.94028 },
  { idade: 58, rendaInvalidez: 72.87, peculioMorte: 138.8571429, peculioInvalidez: 103.571429, pensaoPC1: 15.10071429, pensaoPC5: 79.25707558, pensaoPC10: 151.0426508, pensaoPC15: 216.061058, pensaoPC20: 274.9502326 },
  { idade: 59, rendaInvalidez: 80.03, peculioMorte: 148.2285714, peculioInvalidez: 116.542857, pensaoPC1: 16.11985714, pensaoPC5: 84.60611277, pensaoPC10: 161.2364758, pensaoPC15: 230.6429566, pensaoPC20: 293.5065446 },
  { idade: 60, rendaInvalidez: 87.96, peculioMorte: 158.8190476, peculioInvalidez: 131.342857, pensaoPC1: 17.27157143, pensaoPC5: 90.65095969, pensaoPC10: 172.7563268, pensaoPC15: 247.1216875, pensaoPC20: 314.4766858 },
  { idade: 61, rendaInvalidez: 96.75, peculioMorte: 171.1047619, peculioInvalidez: 148.171429, pensaoPC1: 18.60764286, pensaoPC5: 97.66341699, pensaoPC10: 186.1201828, pensaoPC15: 266.2382009, pensaoPC20: 338.8035583 },
  { idade: 62, rendaInvalidez: 106.47, peculioMorte: 185.5238095, peculioInvalidez: 167.371429, pensaoPC1: 20.17571429, pensaoPC5: 105.8935413, pensaoPC10: 201.8045842, pensaoPC15: 288.6741708, pensaoPC20: 367.3546318 },
  { idade: 63, rendaInvalidez: 117.23, peculioMorte: 202.4761905, peculioInvalidez: 189.228571, pensaoPC1: 22.01928571, pensaoPC5: 115.5696452, pensaoPC10: 220.2446335, pensaoPC15: 315.0519954, pensaoPC20: 400.9219442 },
  { idade: 64, rendaInvalidez: 129.12, peculioMorte: 222.1714286, peculioInvalidez: 214.114286, pensaoPC1: 24.16114286, pensaoPC5: 126.8113209, pensaoPC10: 241.6682413, pensaoPC15: 345.6976928, pensaoPC20: 439.9203722 },
];
