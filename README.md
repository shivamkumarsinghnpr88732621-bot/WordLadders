# WordLadder — Deploy Guide (Hinglish)

## 1. Free Gemini API key lo (2 min)
1. `https://aistudio.google.com/apikey` par jao (Google account se sign in)
2. "Create API key" pe click karo
3. Key copy kar lo (kuch aisi dikhegi: `AIza...`)

Free tier kaafi generous hai is app ke liye — cost kuch nahi lagega normal use mein.

## 2. Netlify ko is repo se connect karo
1. `app.netlify.com` par jao → "Add new site" → "Import from Git"
2. GitHub choose karo, is repo (`WordLadders`) ko select karo
3. Build settings apne aap detect ho jayenge (netlify.toml se)
4. Deploy dabao

## 3. API key ko Netlify mein add karo
1. Project → **Site configuration → Environment variables**
2. "Add a variable" → Key: `GEMINI_API_KEY` → Value: apni copied key paste karo
3. Save karo, phir project ko **re-deploy** karo

## 4. Test karo
Site kholo, koi word type karo, "Samjhao" dabao.
