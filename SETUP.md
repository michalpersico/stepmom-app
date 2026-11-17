# פרסום ב־Cloudflare

החשבון, האחסון והחיוב יהיו בבעלות החוקרת. R2 עשוי לדרוש אמצעי תשלום; בדקו את המחיר המוצג בחשבון לפני הפעלתו. אל תשלחו מפתחות בצ'אט ואל תכניסו אותם לקוד או למאגר.

1. פתחו חשבון ב־Cloudflare והפעילו R2 Object Storage.
2. צרו bucket פרטי בשם `stepmom-study`. השאירו public access כבוי.
3. בתוך ה־bucket צרו תיקייה `media` והעלו לתוכה את `stepmom2026.mp4` המקורי (כ־206MB). המפתח המדויק חייב להיות `media/stepmom2026.mp4`. אפשר להוריד את הקובץ מהקישור שהחוקרת מסרה ב־Drive. אין להעלות אותו ל־GitHub.
4. ב־Workers & Pages בחרו יצירת Worker דרך Import repository / Connect Git ובחרו `michalpersico/stepmom-app`. תיקיית השורש היא `/`. אין build command. פקודת הפרסום היא `npx wrangler deploy`. השם `stepmom-app` והתצורה מוגדרים ב־`wrangler.jsonc`. אשרו את הרשאות החיבור רק למאגר הנדרש.
5. בהגדרות ה־Worker, תחת Variables and Secrets, הוסיפו סודות מסוג Secret:
   - `STUDY_KEY`: קוד הכניסה שתמסרו לנבדקים.
   - `ADMIN_KEY`: מפתח אקראי ארוך ונפרד, לפחות 32 תווים, לשימוש החוקרת בלבד.
   בחרו ערכים שונים. אל תגדירו אותם כמשתני build. הפעילו deploy מחדש אם הממשק דורש זאת.
6. ודאו שבהגדרות Bindings יש R2 בשם `STUDY` המחובר ל־`stepmom-study` (התצורה אמורה ליצור את החיבור בזמן פרסום).
7. השתמשו בכתובת workers.dev שהתקבלה. זהו קישור המטלה לנבדקים. הכתובת עם `/admin.html` בסופה היא מסך הורדת התוצאות; נדרש `ADMIN_KEY`.

## חלופה: פרסום משורת פקודה במחשב החוקרת

לאחר שכפול המאגר והרצת `npm install`:

```sh
npx wrangler login
npx wrangler r2 bucket create stepmom-study
npx wrangler r2 object put stepmom-study/media/stepmom2026.mp4 --file /path/to/stepmom2026.mp4 --remote --content-type video/mp4
npx wrangler secret put STUDY_KEY
npx wrangler secret put ADMIN_KEY
npm run deploy
```

אם ה־bucket כבר קיים, דלגו על יצירתו. הזינו סודות רק בהנחיה האינטראקטיבית של Wrangler. לבדיקות מקומיות השתמשו ב־`.dev.vars` שאינו נכלל ב־Git, וב־R2 מקומי; העלאת `--remote` ופרסום נוגעים בנתוני ייצור.

## בדיקת קבלה לפני מחקר

הפעילו הפעלת ניסיון עם קוד נבדק TEST01. בדקו ניגון עם קול, פרופורציות סרטון וסולם, כיווני חצים וגלגלת, עוגנים והוראות. בדקו שהדירוג מתקבל בכל פריים של הדפדפן ושמסך שחור נמשך לפחות חמש שניות. סיימו צפייה מלאה, היכנסו למסך החוקרת ובדקו יצוא וזמנים מול אירוע playback_started. בדקו גם Escape, יציאה ממסך מלא, ניתוק וחיבור רשת, סגירה ופתיחה מחדש באותו דפדפן. רק אחרי אישור הפיילוט הפיצו קישור למחקר.

השאירו את תוצאות הפיילוט מזוהות בקוד TEST. המאגר אינו שומר נתוני נבדקים, מפתחות או סרטון.
