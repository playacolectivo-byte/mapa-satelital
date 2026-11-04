export type CoastalChapter='current'|'alec'|'historical';
export type ChapterYears=Record<CoastalChapter,number>;
export function chapterBounds(chapter:CoastalChapter,currentYear=new Date().getUTCFullYear()){
 return chapter==='historical'?{first:1910,last:1985}:chapter==='alec'?{first:1986,last:2021}:{first:2010,last:currentYear};
}
// Start on the requested dated comparison, not the computer's current year.
// Other years remain selectable and each chapter keeps its own selection.
export function initialChapterYears(currentYear=new Date().getUTCFullYear()):ChapterYears{return {current:Math.max(2010,Math.min(2025,currentYear)),alec:2021,historical:1951};}
export function withChapterYear(years:ChapterYears,chapter:CoastalChapter,year:number,currentYear=new Date().getUTCFullYear()):ChapterYears{
 const bounds=chapterBounds(chapter,currentYear);
 if(!Number.isFinite(year))return years;
 const next=Math.max(bounds.first,Math.min(bounds.last,Math.round(year)));
 return years[chapter]===next?years:{...years,[chapter]:next};
}
