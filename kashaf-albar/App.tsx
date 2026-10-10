import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { initialPacks } from './src/data/packs';
import { species, Species } from './src/data/species';
import { addSighting, deleteSighting, getFavorites, getSightings, getInstalledPacks, setPackInstalled, Sighting, toggleFavorite } from './src/services/storage';
import { recognizeImageLocally, RecognitionResult, installRecognitionModel, removeRecognitionModel, RecognitionKind } from './src/services/recognition';

const C = { sand:'#F4E7D0', cream:'#FFF9EE', green:'#425C3B', green2:'#6F8555', brown:'#39271D', muted:'#827466', white:'#FFFFFF', line:'#E5D8C4', gold:'#C79A51', warning:'#FFF0D5' };
type Tab = 'home'|'plants'|'animals'|'packs'|'saved'|'favorites';
const categories = [
  {id:'plant', label:'النباتات', icon:'🌿'}, {id:'mammal',label:'الثدييات',icon:'🦌'}, {id:'bird',label:'الطيور',icon:'🦅'}, {id:'reptile',label:'الزواحف',icon:'🦎'}
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [photo, setPhoto] = useState<string|null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all'|'plant'|'mammal'|'bird'|'reptile'>('all');
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [installedPacks, setInstalledPacks] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState('');
  const [recordCategory, setRecordCategory] = useState('غير محدد');
  const [scanKind, setScanKind] = useState<RecognitionKind>('plants');
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');

  const refresh = useCallback(async () => {
    try { const [s,f,p] = await Promise.all([getSightings(),getFavorites(),getInstalledPacks()]); setSightings(s); setFavorites(f); setInstalledPacks(p); }
    catch { Alert.alert('تعذر فتح البيانات المحلية','أغلق التطبيق وافتحه مجددًا. إذا استمرت المشكلة، أرسل تفاصيل الخطأ للمطور.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function choosePhoto(camera: boolean) {
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('نحتاج الإذن', camera ? 'اسمح للتطبيق باستخدام الكاميرا لالتقاط صورة.' : 'اسمح للتطبيق بالوصول إلى الصور لاختيار صورة.'); return; }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes:['images'], quality:0.85 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], quality:0.85 });
      if (!result.canceled && result.assets[0]) {
        // Copy into app-private storage so a temporary picker URI is less likely to expire.
        const source = result.assets[0].uri;
        const dir = `${FileSystem.documentDirectory}discoveries/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates:true }).catch(() => undefined);
        const dest = `${dir}discovery-${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from:source, to:dest }).catch(() => undefined);
        const usableUri = await FileSystem.getInfoAsync(dest).then(info => info.exists ? dest : source);
        setPhoto(usableUri);
        setNote('');
        setRecognition(null);
        setRecognitionError('');
        setRecognizing(true);
        try {
          const result = await recognizeImageLocally(usableUri, scanKind);
          setRecognition(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'تعذر تشغيل محرك التعرف المحلي.';
          setRecognitionError(message);
        } finally {
          setRecognizing(false);
        }
      }
    } catch { Alert.alert('تعذر فتح الصور','تحقق من صلاحيات الكاميرا أو الصور ثم حاول مرة أخرى.'); }
  }

  async function saveSighting() {
    if (!photo) return;
    try { await addSighting(photo, recordCategory, note.trim()); setPhoto(null); setNote(''); setRecognition(null); setRecognitionError(''); await refresh(); Alert.alert('تم الحفظ','أُضيفت الصورة إلى سجل اكتشافاتك على هذا الجهاز. تذكر أن التصنيف العام لا يؤكد النوع العلمي.'); }
    catch { Alert.alert('تعذر الحفظ','لم نتمكن من حفظ السجل. تحقق من مساحة الجهاز وحاول مرة أخرى.'); }
  }
  async function favorite(id:string) { try { await toggleFavorite(id); setFavorites(await getFavorites()); } catch { Alert.alert('تعذر التحديث','لم نستطع تحديث المفضلة.'); } }
  async function togglePack(packId: string) {
    const pack = initialPacks.find(item => item.id === packId);
    if (!pack || !pack.available) { Alert.alert('الحزمة غير متاحة', 'هذه الحزمة غير مضمّنة في النسخة الحالية.'); return; }
    const modelKind: RecognitionKind | null = packId === 'sa-plants' ? 'plants' : (packId === 'sa-mammals' ? 'animals' : (packId === 'sa-birds' ? 'birds' : null));
    try {
      const install = !installedPacks.includes(packId);
      if (modelKind && install) {
        const modelName = modelKind === 'plants' ? 'PlantNet-300K (1,081 فئة نباتية)' : modelKind === 'birds' ? 'AIY Birds V1 (965 فئة للطيور)' : 'CamStack Animal Classifier (تصنيف عام من 8 فئات)';
        Alert.alert('تنزيل نموذج التعرف', `سيتم تنزيل ${modelName} من Hugging Face والتحقق من ملفات الحزمة ثم تثبيته على الجهاز. يحتاج الإنترنت للتنزيل الأول فقط.`, [
          {text:'إلغاء',style:'cancel'},
          {text:'تنزيل',onPress: async () => {
            try {
              const result = await installRecognitionModel(modelKind);
              await setPackInstalled(packId, true);
              setInstalledPacks(await getInstalledPacks());
              Alert.alert('اكتمل تثبيت النموذج', `${result.model} — ${result.classes} فئة. ${result.message}`);
            } catch (e) { Alert.alert('فشل تنزيل النموذج', e instanceof Error ? e.message : 'تحقق من الإنترنت وحاول مجددًا.'); }
          }}
        ]);
        return;
      }
      if (modelKind && !install) {
        Alert.alert('إزالة نموذج التعرف؟','سيتم حذف ملفات النموذج المحلية، ولن يعمل التعرف المتخصص لهذه الفئة حتى تنزيله مجددًا.',[
          {text:'إلغاء',style:'cancel'}, {text:'إزالة',style:'destructive',onPress:async()=>{try{await removeRecognitionModel(modelKind);await setPackInstalled(packId,false);setInstalledPacks(await getInstalledPacks());Alert.alert('تمت الإزالة','حُذفت ملفات النموذج المحلية من الجهاز.');}catch{Alert.alert('تعذرت الإزالة','حاول مرة أخرى.');}}}
        ]); return;
      }
      await setPackInstalled(packId, install); setInstalledPacks(await getInstalledPacks()); Alert.alert(install ? 'تم تفعيل الحزمة' : 'تمت إزالة الحزمة', install ? 'تم تفعيل سجلات الدليل المحلية. لا تتضمن هذه الحزمة نموذج تعرف متخصصًا.' : 'أزيلت الحزمة من قائمة الحزم المفعّلة.');
    } catch { Alert.alert('تعذر تحديث الحزمة', 'حاول مرة أخرى.'); }
  }

  const visibleSpecies = useMemo(() => species.filter(x => (filter==='all'||x.category===filter) && `${x.nameAr} ${x.nameEn} ${x.scientificName}`.toLowerCase().includes(query.toLowerCase()) && (installedPacks.length===0 || initialPacks.some(p=>installedPacks.includes(p.id) && p.speciesIds.includes(x.id)))), [filter,query,installedPacks]);
  const navItems: {id:Tab;icon:string;label:string}[] = [
    {id:'home',icon:'⌂',label:'الرئيسية'},{id:'plants',icon:'❀',label:'الدليل'},{id:'animals',icon:'♧',label:'الكائنات'},{id:'packs',icon:'⇩',label:'الحزم'},{id:'saved',icon:'▤',label:'سجلي'}
  ];
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={C.cream}/>
    <View style={s.topbar}><View><Text style={s.brand}>كَشّاف البر</Text><Text style={s.tagline}>اكتشف الطبيعة.. واعرف أسرارها</Text></View><View style={s.brandMark}><Text style={{fontSize:25}}>🌿</Text></View></View>
    {busy ? <View style={s.loading}><ActivityIndicator size="large" color={C.green}/><Text style={s.smallText}>جارٍ تجهيز بياناتك المحلية...</Text></View> : <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {tab==='home' && <>
        <View style={s.hero}><Text style={s.heroEyebrow}>رفيقك في البر</Text><Text style={s.heroTitle}>وش لقيت في البر اليوم؟</Text><Text style={s.heroBody}>التقط صورة لتحليلها على الجهاز. عند تثبيت نموذج الأنواع المتخصص سيستخدمه التطبيق محليًا؛ وإلا فسيعرض تصنيفات عامة فقط.</Text><Text style={[s.heroBody,{fontWeight:'800',marginBottom:7}]}>نوع الكائن المراد التعرف عليه</Text><View style={s.chips}>{[{id:'plants' as RecognitionKind,label:'🌿 نبات'},{id:'animals' as RecognitionKind,label:'🐾 حيوان'},{id:'birds' as RecognitionKind,label:'🦅 طائر'}].map(k=><Pressable key={k.id} onPress={()=>setScanKind(k.id)} style={[s.chip,scanKind===k.id&&s.chipSelected]}><Text style={[s.chipText,scanKind===k.id&&s.chipTextSelected]}>{k.label}</Text></Pressable>)}</View><Pressable style={s.primaryBtn} onPress={() => choosePhoto(true)}><Text style={s.primaryBtnText}>📸  صوّر كائنًا</Text></Pressable><Pressable style={s.secondaryBtn} onPress={() => choosePhoto(false)}><Text style={s.secondaryBtnText}>اختر صورة من الألبوم</Text></Pressable></View>
        {photo && <View style={s.formCard}><Image source={{uri:photo}} style={s.largePreview}/><Text style={s.cardTitle}>{recognition?.speciesLevel ? 'نتيجة نموذج الأنواع المتخصص' : 'نتيجة التصنيف العام المحلي'}</Text>{recognizing ? <View style={s.recognitionLoading}><ActivityIndicator color={C.green}/><Text style={s.smallText}>يجري تحليل الصورة على الجهاز...</Text></View> : null}{recognitionError ? <Text style={s.caution}>{recognitionError}</Text> : null}{recognition?.predictions.map((item,index)=><View key={`${item.label}-${index}`} style={s.predictionRow}><Text style={s.predictionLabel}>{item.label.replace(/_/g,' ')}</Text><Text style={s.predictionConfidence}>{Math.round(item.confidence*100)}%</Text></View>)}{recognition && <Text style={s.smallTextWide}>{recognition.message}</Text>}<Text style={s.smallTextWide}>يمكنك حفظ الصورة كسجل ميداني. لا تعتمد على التصنيفات العامة لتحديد نبات صالح للأكل أو لتحديد حيوان خطير.</Text><View style={s.chips}>{['نبات','حيوان','طائر','زاحف','غير محدد'].map(x=><Pressable key={x} onPress={()=>setRecordCategory(x)} style={[s.chip,recordCategory===x&&s.chipSelected]}><Text style={[s.chipText,recordCategory===x&&s.chipTextSelected]}>{x}</Text></Pressable>)}</View><TextInput value={note} onChangeText={setNote} placeholder="ملاحظة اختيارية عن الاكتشاف" placeholderTextColor={C.muted} style={s.input} multiline maxLength={500}/><Pressable style={s.primaryBtn} onPress={saveSighting}><Text style={s.primaryBtnText}>حفظ في اكتشافاتي</Text></Pressable><Pressable onPress={()=>{setPhoto(null);setRecognition(null);setRecognitionError('');}} style={s.cancelBtn}><Text style={s.smallText}>إلغاء</Text></Pressable></View>}
        <Text style={s.sectionTitle}>استكشف الدليل</Text><View style={s.twoCol}><Pressable style={s.categoryCard} onPress={()=>{setFilter('plant');setTab('plants')}}><Text style={s.categoryEmoji}>🌿</Text><Text style={s.cardTitle}>النباتات البرية</Text><Text style={s.smallText}>الأشجار والأزهار والأعشاب</Text></Pressable><Pressable style={s.categoryCard} onPress={()=>{setFilter('all');setTab('animals')}}><Text style={s.categoryEmoji}>🦌</Text><Text style={s.cardTitle}>الحيوانات والطيور</Text><Text style={s.smallText}>معلومات أولية عن أنواع مختارة</Text></Pressable></View>
        <View style={s.infoBanner}><Text style={s.infoIcon}>📶</Text><View style={{flex:1}}><Text style={s.cardTitle}>مصمم للاستخدام في البر</Text><Text style={s.smallText}>التصنيف العام يعمل محليًا على iPhone. التعرف المتخصص يتطلب تثبيت ملف نموذج Core ML موثوق في مجلد النماذج.</Text></View></View>
        <Text style={s.sectionTitle}>أنواع في الدليل</Text>{species.slice(0,3).map(item=><SpeciesRow key={item.id} item={item} isFavorite={favorites.includes(item.id)} onFavorite={()=>favorite(item.id)}/>)}
      </>}
      {(tab==='plants'||tab==='animals') && <><Text style={s.pageTitle}>{tab==='plants'?'دليل النباتات':'دليل الحيوانات والكائنات'}</Text><TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالاسم العربي أو الإنجليزي أو العلمي" placeholderTextColor={C.muted} style={s.search}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{[{id:'all',label:'الكل'},...categories].map(x=><Pressable key={x.id} onPress={()=>setFilter(x.id as typeof filter)} style={[s.chip,filter===x.id&&s.chipSelected]}><Text style={[s.chipText,filter===x.id&&s.chipTextSelected]}>{x.label}</Text></Pressable>)}</ScrollView>{visibleSpecies.map(item=><SpeciesRow key={item.id} item={item} isFavorite={favorites.includes(item.id)} onFavorite={()=>favorite(item.id)}/>)}{visibleSpecies.length===0&&<Text style={s.emptyText}>لا توجد نتائج مطابقة. جرّب كلمة أخرى.</Text>}<View style={s.notice}><Text style={s.smallTextWide}>هذا دليل تجريبي محدود، وليس موسوعة كاملة أو أداة تشخيص. أسماء المجموعات العامة مثل «الغزال» أو «الصقور» لا تعني تحديد نوع دقيق.</Text></View></>}
      {tab==='packs' && <><Text style={s.pageTitle}>حزم الدليل دون إنترنت</Text><Text style={s.smallTextWide}>تتيح الحزم تنزيل نماذج Core ML فعلية من Hugging Face. يلزم الإنترنت للتنزيل الأول فقط؛ بعده يعمل الاستدلال محليًا. نموذج النباتات يغطي 1,081 فئة، ونموذج الطيور 965 فئة، أما نموذج الحيوانات العام فيغطي 8 فئات فقط.</Text>{initialPacks.map(p=><View key={p.id} style={s.packRow}><View style={s.packEmoji}><Text style={{fontSize:24}}>{p.icon}</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>{p.title}</Text><Text style={s.smallText}>{p.subtitle}</Text><Text style={s.tinyText}>{p.id==='sa-plants'?'1,081 فئة نباتية (نموذج عالمي)':p.id==='sa-mammals'?'8 فئات حيوانية عامة':p.id==='sa-birds'?'965 فئة طيور (نموذج عام)':p.countLabel} · {(['sa-plants','sa-mammals','sa-birds'].includes(p.id))?'تنزيل نموذج عند الطلب':p.size}</Text></View><Pressable disabled={!p.available} onPress={()=>togglePack(p.id)} style={[s.packStatus,installedPacks.includes(p.id)&&s.packInstalled,!p.available&&s.packUnavailable]}><Text style={s.packStatusText}>{!p.available?'لاحقًا':installedPacks.includes(p.id)?'مثبّتة ✓':(['sa-plants','sa-mammals','sa-birds'].includes(p.id))?'تنزيل النموذج':'تفعيل الدليل'}</Text></Pressable></View>)}<View style={s.notice}><Text style={s.smallTextWide}>نموذج النباتات عام وليس مدربًا خصيصًا على نباتات السعودية. نموذج الطيور يضم 965 فئة لكنه يحتاج اختبارًا محليًا. نموذج الحيوانات العام يصنف 8 فئات ولا يحدد الأنواع العلمية الدقيقة. يجب التحقق ميدانيًا من كل نتيجة، ولا تستخدمها لتحديد السمية أو السلامة.</Text></View></>}
      {tab==='saved' && <><Text style={s.pageTitle}>اكتشافاتي</Text><Text style={s.smallTextWide}>السجلات محفوظة في قاعدة بيانات محلية على هذا الجهاز.</Text>{sightings.map(x=><View key={x.id} style={s.sighting}><Image source={{uri:x.imageUri}} style={s.sightingImage}/><View style={{flex:1}}><Text style={s.cardTitle}>{x.category}</Text><Text style={s.smallText}>{x.note||'بدون ملاحظة'}</Text><Text style={s.tinyText}>{new Date(x.createdAt).toLocaleString()}</Text><Text style={s.tinyText}>لم يتم التعرف على النوع تلقائيًا</Text></View><Pressable onPress={()=>Alert.alert('حذف السجل؟','سيُحذف هذا السجل من الجهاز.',[{text:'إلغاء',style:'cancel'},{text:'حذف',style:'destructive',onPress:async()=>{await deleteSighting(x.id);refresh();}}])}><Text style={s.delete}>حذف</Text></Pressable></View>)}{sightings.length===0&&<View style={s.empty}><Text style={{fontSize:42}}>▤</Text><Text style={s.cardTitle}>ما حفظت اكتشافات حتى الآن</Text><Text style={s.smallText}>التقط صورة من الصفحة الرئيسية لحفظ أول سجل.</Text></View>}</>}
    </ScrollView>}
    <View style={s.nav}>{navItems.map(n=><Pressable key={n.id} style={s.navItem} onPress={()=>{setTab(n.id);if(n.id==='plants')setFilter('plant');if(n.id==='animals')setFilter('all');}}><Text style={[s.navIcon,tab===n.id&&s.navActive]}>{n.icon}</Text><Text style={[s.navLabel,tab===n.id&&s.navLabelActive]}>{n.label}</Text></Pressable>)}<Pressable style={s.navItem} onPress={()=>setTab('favorites')}><Text style={[s.navIcon,tab==='favorites'&&s.navActive]}>☆</Text><Text style={[s.navLabel,tab==='favorites'&&s.navLabelActive]}>المفضلة</Text></Pressable></View>
    {tab==='favorites'&&<View style={s.favoriteOverlay}><View style={s.favoritePanel}><View style={s.panelHead}><Text style={s.pageTitle}>المفضلة</Text><Pressable onPress={()=>setTab('home')}><Text style={s.close}>إغلاق ✕</Text></Pressable></View><ScrollView>{species.filter(x=>favorites.includes(x.id)).map(item=><SpeciesRow key={item.id} item={item} isFavorite onFavorite={()=>favorite(item.id)}/>) }{favorites.length===0&&<Text style={s.emptyText}>أضف أنواعًا إلى المفضلة من الدليل.</Text>}</ScrollView></View></View>}
  </SafeAreaView>;
}

function SpeciesRow({item,isFavorite,onFavorite}:{item:Species;isFavorite:boolean;onFavorite:()=>void}) { return <View style={s.speciesRow}><View style={s.speciesIcon}><Text style={{fontSize:24}}>{item.category==='plant'?'🌿':item.category==='bird'?'🦅':item.category==='reptile'?'🦎':'🐾'}</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>{item.nameAr}</Text><Text style={s.smallText}>{item.nameEn}</Text><Text style={s.scientific}>{item.scientificName}</Text><Text style={s.smallText}>{item.description}</Text>{item.caution&&<Text style={s.caution}>{item.caution}</Text>}</View><Pressable onPress={onFavorite} accessibilityLabel={isFavorite?'إزالة من المفضلة':'إضافة إلى المفضلة'}><Text style={s.star}>{isFavorite?'★':'☆'}</Text></Pressable></View>; }

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.cream},topbar:{paddingHorizontal:20,paddingTop:12,paddingBottom:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:26,fontWeight:'900',color:C.brown,textAlign:'right'},tagline:{fontSize:12,color:C.muted,marginTop:2,textAlign:'right'},brandMark:{width:48,height:48,borderRadius:16,backgroundColor:C.sand,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.line},content:{paddingHorizontal:18,paddingBottom:26},recognitionLoading:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingVertical:12},predictionRow:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center',backgroundColor:'#F4E7D0',borderRadius:10,padding:10,marginBottom:6},predictionLabel:{fontSize:13,fontWeight:'700',color:C.brown,flex:1,textAlign:'right'},predictionConfidence:{fontSize:12,fontWeight:'900',color:C.green,marginLeft:10},hero:{backgroundColor:C.green,borderRadius:26,padding:22,marginTop:4,overflow:'hidden'},heroEyebrow:{color:'#D6E0C5',fontSize:13,fontWeight:'700',textAlign:'right'},heroTitle:{fontSize:27,fontWeight:'900',color:C.white,textAlign:'right',marginTop:9},heroBody:{fontSize:14,color:'#F0E9DA',lineHeight:23,textAlign:'right',marginTop:8,marginBottom:18},primaryBtn:{backgroundColor:C.gold,borderRadius:14,paddingVertical:14,paddingHorizontal:16,alignItems:'center',marginTop:8},primaryBtnText:{color:C.brown,fontSize:16,fontWeight:'900'},secondaryBtn:{borderWidth:1,borderColor:'#C5D0B8',borderRadius:14,paddingVertical:12,alignItems:'center',marginTop:10},secondaryBtnText:{color:C.white,fontSize:14,fontWeight:'700'},sectionTitle:{fontSize:19,fontWeight:'900',color:C.brown,textAlign:'right',marginTop:24,marginBottom:12},twoCol:{flexDirection:'row',gap:12},categoryCard:{flex:1,backgroundColor:C.white,borderRadius:20,padding:15,borderWidth:1,borderColor:C.line,minHeight:145,alignItems:'flex-end'},categoryEmoji:{fontSize:32,marginBottom:8},cardTitle:{fontSize:15,fontWeight:'800',color:C.brown,textAlign:'right'},smallText:{fontSize:12,color:C.muted,textAlign:'right',marginTop:5,lineHeight:18},smallTextWide:{fontSize:13,color:C.muted,textAlign:'right',lineHeight:21,marginBottom:12},tinyText:{fontSize:10,color:C.green2,textAlign:'right',marginTop:5},infoBanner:{marginTop:14,padding:15,borderRadius:18,backgroundColor:'#E9EEDD',flexDirection:'row',gap:12,alignItems:'center'},infoIcon:{fontSize:28},packRow:{backgroundColor:C.white,borderRadius:17,borderWidth:1,borderColor:C.line,padding:12,marginBottom:10,flexDirection:'row-reverse',alignItems:'center',gap:11},packEmoji:{width:48,height:48,borderRadius:15,backgroundColor:C.sand,alignItems:'center',justifyContent:'center'},packStatus:{backgroundColor:'#F3E7D1',paddingHorizontal:10,paddingVertical:7,borderRadius:10},packInstalled:{backgroundColor:'#DDE8D4'},packUnavailable:{opacity:0.55},packStatusText:{fontSize:11,color:C.brown,fontWeight:'800'},nav:{flexDirection:'row-reverse',paddingTop:10,paddingBottom:8,paddingHorizontal:3,borderTopWidth:1,borderTopColor:C.line,backgroundColor:C.white},navItem:{flex:1,alignItems:'center',gap:3},navIcon:{fontSize:21,color:'#9B9184'},navActive:{color:C.green,fontWeight:'900'},navLabel:{fontSize:9,color:'#9B9184'},navLabelActive:{color:C.green,fontWeight:'800'},formCard:{marginTop:12,padding:14,backgroundColor:C.white,borderRadius:18,borderWidth:1,borderColor:C.line},largePreview:{width:'100%',height:190,borderRadius:14,marginBottom:12,backgroundColor:C.sand},chips:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7,marginVertical:10},chip:{borderRadius:18,borderWidth:1,borderColor:C.line,paddingHorizontal:12,paddingVertical:8,backgroundColor:C.white},chipSelected:{backgroundColor:C.green,borderColor:C.green},chipText:{fontSize:12,color:C.brown},chipTextSelected:{color:C.white,fontWeight:'800'},input:{borderWidth:1,borderColor:C.line,borderRadius:12,padding:12,minHeight:48,textAlign:'right',color:C.brown,marginTop:5},cancelBtn:{alignItems:'center',padding:8},pageTitle:{fontSize:23,fontWeight:'900',color:C.brown,textAlign:'right',marginVertical:12},search:{borderWidth:1,borderColor:C.line,backgroundColor:C.white,borderRadius:14,paddingHorizontal:14,paddingVertical:12,textAlign:'right',color:C.brown,marginVertical:10},speciesRow:{backgroundColor:C.white,borderRadius:16,borderWidth:1,borderColor:C.line,padding:12,marginBottom:10,flexDirection:'row-reverse',alignItems:'flex-start',gap:10},speciesIcon:{width:44,height:44,borderRadius:14,backgroundColor:C.sand,alignItems:'center',justifyContent:'center'},scientific:{fontSize:11,fontStyle:'italic',color:C.green2,textAlign:'right',marginTop:3},caution:{fontSize:11,color:'#8A4F12',textAlign:'right',marginTop:5,lineHeight:17},star:{fontSize:24,color:C.gold,paddingHorizontal:3},notice:{backgroundColor:C.warning,borderRadius:12,padding:12,marginTop:12},empty:{alignItems:'center',paddingTop:55,gap:10},emptyText:{textAlign:'center',color:C.muted,padding:24,lineHeight:22},sighting:{backgroundColor:C.white,borderRadius:16,borderWidth:1,borderColor:C.line,padding:10,marginBottom:10,flexDirection:'row-reverse',alignItems:'center',gap:10},sightingImage:{width:74,height:74,borderRadius:12,backgroundColor:C.sand},delete:{color:'#A23D31',fontWeight:'800',padding:6},loading:{flex:1,alignItems:'center',justifyContent:'center',gap:12},favoriteOverlay:{position:'absolute',top:0,bottom:55,left:0,right:0,backgroundColor:'rgba(30,25,20,0.35)',justifyContent:'flex-end'},favoritePanel:{height:'70%',backgroundColor:C.cream,borderTopLeftRadius:24,borderTopRightRadius:24,padding:18},panelHead:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},close:{color:C.green,fontWeight:'800'}
});
