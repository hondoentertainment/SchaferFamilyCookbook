import React from 'react';

export const HistoryView: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#FDFBF7] py-20 px-6 animate-in fade-in duration-1000">
            <div className="max-w-4xl mx-auto space-y-24">
                {/* Hero / Introduction */}
                <header className="text-center space-y-8">
                    <div className="inline-block px-4 py-1.5 rounded-full border border-[#2D4635]/10 bg-[#2D4635]/5 text-[10px] font-black uppercase tracking-widest text-[#2D4635] mb-4">
                        Legacy & Heritage
                    </div>
                    <h1 className="text-5xl md:text-7xl font-serif italic text-[#2D4635] leading-tight">
                        Schafer / Oehler <br />
                        <span className="text-[#A0522D]">Family Food History</span>
                    </h1>
                    <div className="h-px w-24 bg-[#A0522D]/30 mx-auto" />
                    <p className="text-stone-500 font-serif italic text-lg max-w-2xl mx-auto leading-relaxed">
                        "As remembered by Julie Joy Schafer Johnson, from stories told by my parents Oliver Schafer and Harriet (Oehler) Schafer, and from our extended family."
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0522D]">Prepared for the Schafer Family Cookbook</p>
                </header>

                {/* Main Content Sections */}
                <div className="space-y-20 font-serif text-stone-800 leading-relaxed text-lg pb-32">

                    <section className="relative">
                        <div className="absolute -left-12 top-0 text-6xl text-[#A0522D]/10 font-serif hidden lg:block opacity-50">“</div>
                        <p className="text-2xl italic text-[#2D4635] font-serif mb-12 border-l-4 border-[#F4A460] pl-8 py-2">
                            Our family has been involved in producing and preparing food for centuries.
                        </p>
                    </section>

                    {/* The Oehler Family */}
                    <section className="space-y-8 bg-white/50 backdrop-blur-sm p-12 md:p-20 rounded-[4rem] border border-stone-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-[100px] -mr-32 -mt-32 opacity-50" />
                        <h2 className="text-4xl font-serif italic text-[#2D4635] mb-8 relative">The Oehler Family</h2>
                        <div className="space-y-6 relative text-stone-600">
                            <p>
                                <span className="float-left text-7xl font-serif text-[#A0522D] mr-4 leading-[0.8] mt-1 italic">T</span>
                                he Oehler family originally came from Bavaria in southern Germany to the United States in the mid-1800s. The name Oehler means to produce or deal in oil—presumably rendering oil from animals such as cattle, pigs, geese, and chickens, and selling it to others. How the Oehlers found their way to southern Minnesota, I do not know, but I hope to find out someday.
                            </p>
                            <p>
                                Gottfried Oehler, from a large family and one of many brothers, and his wife Mary (whose maiden name I do not know, but who was from Switzerland) ran a general store in Wells, Minnesota in the 1870s. They had a son, Edward Oehler (born 1875).
                            </p>
                            <p>
                                Edward and his second wife, Minnie Willmert (born 1875, married in 1910, from Blue Earth, Minnesota), raised their two daughters—Adelia (born 1912) and Harriet Wilma (born 1915)—on a farm about one mile south of Buffalo Lake and one mile east of the original Buffalo Lake Schafer farm where Teal and Jana now live.
                            </p>
                            <div className="py-6 border-y border-stone-50">
                                <p className="italic text-[#2D4635]/80">
                                    "Harriet told stories of childhood Christmases when it was very special to receive an orange, an apple, peanuts, and a new pair of hand-knit mittens. Oyster stew was a special Christmas meal."
                                </p>
                            </div>
                            <p>
                                Like most rural families in the early 1900s, the Oehlers relied heavily on their vegetable garden and spent many hours drying and canning fruits and vegetables. Harriet learned these essential farm food skills as a young girl.
                            </p>
                            <p>
                                Eggs and chickens played a major role in their daily life. Harriet told stories of the family’s fear of “gypsies”—traveling families who camped in a grove west of the house and were rumored to steal chickens and eggs at night. Minnie feared they might also steal her little girls, a fear that Harriet carried with her. Harriet also liked to tell, with some pride and a lot of humor, that her father drank raw eggs because he believed they settled his stomach and made him strong. She always ended the story with an emphatic, “AAACK!”
                            </p>
                            <p>
                                Sundays were special at the Oehler home. Minnie usually took the girls to church, while Edward sometimes stayed home to prepare Sunday dinner. Afternoons were spent visiting family or friends. Minnie was also a fisherwoman. After Sunday dinner she would pack a picnic, hitch up the horse-drawn buggy, and take the girls to Lake Preston to fish and eat together.
                            </p>
                        </div>
                    </section>

                    {/* The Schafer Family */}
                    <section className="space-y-8 p-12 md:p-20">
                        <h2 className="text-4xl font-serif italic text-[#2D4635] mb-8">The Schafer Family</h2>
                        <div className="space-y-6 text-stone-600">
                            <p>
                                The Schafer family immigrated from northern Germany to the United States in the mid-1800s, living first in Indiana, Illinois, and Iowa before settling in the Sherburne, Minnesota area just north of the Iowa border. Schafer means shepherd in German, and it seems likely the Schafers were shepherds and farmers for generations.
                            </p>
                            <p>
                                John Daniel “JD” Schafer (born 1873) and Dora (Finke) Schafer (born 1875) had eleven children in the Sherburne area. Oliver (born 1915) was the tenth of the eleven. In 1919, JD and Dora moved the family to the farm south of Buffalo Lake where James, Kay, Ruthann, and I were raised.
                            </p>
                            <div className="bg-stone-50 p-8 rounded-3xl border border-stone-100 italic text-[#2D4635]/80">
                                "Oliver told happy stories of growing up in a large farm family. When he was young, the fields were worked with horses—Pet and Patty were his favorites. East of the old farmhouse was an orchard of plums and apples. Oliver fondly remembered his sisters drying plums on screens laid out on the porch roof."
                            </div>
                            <p>
                                Large gardens, orchards, canning, drying, and baking were all part of daily life on the Schafer farm. Oliver grew up eating frequent breakfasts of cornmeal mush with sorghum syrup. Harriet would sometimes make it for him later in life, though not too often—she did not care for it.
                            </p>
                        </div>
                    </section>

                    {/* Harriet and Oliver */}
                    <section className="space-y-8 bg-[#2D4635] text-emerald-50 p-12 md:p-20 rounded-[4rem] shadow-2xl relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-400 rounded-full blur-[120px] -ml-48 -mb-48 opacity-10" />
                        <h2 className="text-4xl font-serif italic text-[#F4A460] mb-8 relative">Harriet and Oliver</h2>
                        <div className="space-y-6 relative opacity-90">
                            <p>
                                Harriet and Oliver married in 1935 and lived with Minnie and Edward on their farm during the Depression. Times were hard. Soon after, the farm was sold, and Harriet, Oliver, and little Jimmy moved in with JD and Dora.
                            </p>
                            <p>
                                Oliver and Harriet raised beef cattle—Angus, Hereford, black white-faced, Charolais, and crosses. During my childhood (1956–1975), they had about forty cow-calf units in pasture, a bull, and fifty to sixty head of cattle in the feedlot.
                            </p>
                            <p>
                                Harriet ran a serious chicken operation in the long, low building west of the house. At times she kept nearly one hundred Leghorns. I remember collecting eggs, carrying them to the basement in a heavy wire basket, and packing them into sturdy cardboard boxes that held a gross—144 eggs.
                            </p>
                            <p>
                                I remember butchering chickens in the fall—once so cold that we hung the birds from basement pipes to work inside. Dad and Jim planted field corn, oats, soybeans, sorghum, and alfalfa. Every season had its own rhythm and purpose.
                            </p>
                        </div>
                    </section>

                    {/* A Legacy of Food */}
                    <section className="text-center space-y-8 py-20">
                        <div className="h-px w-24 bg-[#A0522D]/30 mx-auto" />
                        <h2 className="text-4xl font-serif italic text-[#2D4635]">A Legacy of Food</h2>
                        <div className="max-w-2xl mx-auto space-y-6 italic text-stone-500">
                            <p>
                                Harriet was an excellent farm cook. Nearly everything she made was from scratch, using ingredients from her garden, her canner, her freezer, the chicken coop, the feedlot, the hog pen, and the local lakes.
                            </p>
                            <p className="text-[#2D4635] font-bold not-italic text-xl">
                                Food was not just nourishment—it was work, tradition, love, and survival.
                            </p>
                        </div>
                        <p className="text-[#A0522D] font-serif transition-all hover:scale-105 inline-block">
                            That legacy of food, family, and sharing lives on in this cookbook.
                        </p>
                        <div className="pt-12">
                            <span className="text-4xl">🌾</span>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};
