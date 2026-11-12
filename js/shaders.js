// DV85 EMBER COUNTDOWN · GLSL (WebGL2). All coordinates are CSS px, y down, in the fx canvas (the hero).
// FX    : the room — soot wall lit by the hot metal, halo, flames licking off hot digits, steel floor + brushed reflection.
// METAL : the digits' surface (only inside the SVG <text> clip): blackbody emission, cooling scale with glowing cracks,
//         hotter core, forged bevel, the pour (liquid metal fills the new digit bottom-up), cold iron after the sale.
// EMBER : stateless GPU particles (instanced quads stretched along velocity): sparks, embers, bokeh, pour splashes.

const COMMON = `
float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm3(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.1,9.2); a*=0.5; } return s/0.875; }
float fbm4(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.1,9.2); a*=0.5; } return s/0.9375; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
// incandescence: dull red -> cherry -> orange -> yellow -> white; returns linear radiance
vec3 blackbody(float t){
  t=max(t,0.0);
  vec3 c=mix(vec3(0.22,0.014,0.0), vec3(0.95,0.14,0.012), smoothstep(0.0,0.32,t));
  c=mix(c, vec3(1.0,0.40,0.05), smoothstep(0.30,0.58,t));
  c=mix(c, vec3(1.0,0.72,0.30), smoothstep(0.58,0.84,t));
  c=mix(c, vec3(1.0,0.95,0.84), smoothstep(0.84,1.08,t));
  return c*(0.025+0.9*t*t+1.75*t*t*t*t);
}
`;

const ATLAS = `
uniform sampler2D uAtlas; uniform vec4 uAtl; uniform vec2 uAtlSize;   // cellW, cellH, atlas font px, baseline row
// l = (p - (cx, baseline)) / F   (em, y down)
vec4 glyph(float d, vec2 l){
  vec2 a=vec2(l.x*uAtl.z, uAtl.w+l.y*uAtl.z);
  if(abs(a.x)>uAtl.x*0.5-1.0 || a.y<1.0 || a.y>uAtl.y-1.0) return vec4(0.0);
  a.x+=(d+0.5)*uAtl.x;
  return textureLod(uAtlas, a/uAtlSize, 0.0);
}
`;

const SCENE = `
uniform vec4 uSlot[8];    // cx, digit (-1 = hidden), heat, flame
uniform vec4 uAux[8];     // flash, pointer boost, pour (0..1, 1 = settled), old digit
uniform vec4 uColon[3];   // cx, visible, heat, 0
uniform vec4 uGeo;        // F, baseline, span x0, span x1
uniform vec4 uFx;         // final seconds 0..1, tick pulse, cold 0..1 (sale over), flare
uniform float uTime;
const float CAP=0.711;
`;

export const FX_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uS; uniform vec2 uPage;
uniform sampler2D uSoot;
${SCENE}
${COMMON}
${ATLAS}
out vec4 o;
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0))+min(max(d.x,d.y),0.0); }
void main(){
  vec2 p=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uS;
  float F=uGeo.x, by=uGeo.y, cap=CAP*F;
  float fin=uFx.x, pulse=uFx.y, flare=uFx.w;
  float floorY=by+0.016*F;
  bool onFloor=p.y>floorY;
  float dy=p.y-floorY;
  vec2 pm=vec2(p.x, 2.0*by-p.y+0.02*F);
  float bl=clamp(dy/(0.36*F),0.0,1.0);
  vec3 room=vec3(0.0), halo=vec3(0.0), flame=vec3(0.0), refl=vec3(0.0);
  for(int i=0;i<8;i++){
    vec4 S=uSlot[i]; if(S.y<0.0) continue;
    vec4 X=uAux[i];
    float heat=S.z+X.y;
    vec3 bb=blackbody(heat*0.9)*vec3(1.0,0.78,0.6);
    float dist=max(sdBox(p-vec2(S.x, by-cap*0.5), vec2(0.27*F, cap*0.5)), 0.0);
    room+=bb*(exp(-dist/(0.40*F))*0.05+exp(-dist/(1.8*F))*0.0095)*(1.0+1.1*X.x);
    if(abs(p.x-S.x)>0.8*F) continue;
    if(!onFloor){
      vec4 g=glyph(S.y, (p-vec2(S.x,by))/F);
      halo+=blackbody(heat*0.8+0.14)*vec3(1.0,0.85,0.6)*(g.b*0.55+g.a*1.6+g.g*0.5)*(0.6+0.9*X.x);
      float fl=S.w;
      if(fl>0.01 && p.y>by-1.6*F){
        vec2 sp=p/F;
        float n1=fbm3(vec2(sp.x*3.4+S.x*0.013, sp.y*1.6+uTime*1.6));
        float n2=fbm3(vec2(sp.x*9.0+3.0, sp.y*2.6+uTime*3.1));
        vec2 q=p+vec2((n1-0.5)*0.24*F, (0.015+(0.26+0.40*fl)*n2*n2)*F);
        vec4 gq=glyph(S.y, (q-vec2(S.x,by))/F);
        float src=gq.a*0.75+gq.b*0.4;
        float f=smoothstep(0.38,1.05, src*(0.45+1.1*n2))*min(fl,1.4);
        float ft=clamp(0.30+0.62*f,0.0,1.0);
        flame+=blackbody(ft)*vec3(1.0,0.86,0.7)*f*0.5;
      }
    } else if(dy<1.5*F){
      vec4 g=glyph(S.y, (pm-vec2(S.x,by))/F);
      float m=mix(mix(g.r*0.8+g.g*0.2, g.a, smoothstep(0.0,0.22,bl)), g.b*0.62, smoothstep(0.22,1.0,bl));
      refl+=blackbody(heat*(0.78+0.3*g.a))*m;
    }
  }
  for(int c=0;c<3;c++){
    vec4 C=uColon[c]; if(C.y<0.5) continue;
    vec3 bb=blackbody(C.z);
    for(int k=0;k<2;k++){
      vec2 dc=vec2(C.x, by-(k==0?0.52:0.20)*F);
      float r=0.055*F;
      vec2 q=onFloor? pm : p;
      float d=length(q-dc);
      float m=onFloor? exp(-pow(d/(r*(1.0+2.5*bl)),2.0)) : 0.0;
      if(!onFloor) halo+=bb*exp(-pow(max(d-r*0.7,0.0)/(0.07*F),2.0))*0.55;
      refl+=bb*m*0.9;
      room+=bb*exp(-d/(0.35*F))*0.02;
    }
  }
  float s1=texture(uSoot, p/640.0).r, s2=texture(uSoot, p/170.0+0.37).r;
  float soot=0.5+(0.62*s1+0.38*s2-0.5)*0.55;
  vec3 L=room*(1.0+0.25*fin+0.55*pulse*fin)+halo*0.16;
  L+=vec3(0.010,0.0045,0.0015)*pulse*fin*exp(-abs(p.y-by)/(1.2*F));
  vec3 wall=vec3(0.0128,0.0078,0.0058)*(0.7+0.6*soot);
  float vy=p.y/uPage.y;
  wall*=mix(1.15, 0.85, vy);
  vec3 col=wall+L*vec3(1.0,0.72,0.55)*(0.45+0.9*soot);
  if(onFloor){
    float brushed=0.78+0.44*vnoise(vec2(p.x*0.006, p.y*0.9))*vnoise(vec2(p.x*0.02+5.0, p.y*0.35));
    vec3 steel=vec3(0.0082,0.0077,0.0076)*(0.85+0.3*soot);
    float fall=exp(-dy/(0.85*F));
    col=steel*brushed + L*0.26*fall*brushed + refl*0.13*exp(-dy/(1.0*F))*brushed;
    col+=vec3(1.0,0.52,0.22)*exp(-pow(dy/1.3,2.0))*clamp(length(room)*3.0,0.0,1.4)*0.55;
  } else {
    col+=halo*0.7;
  }
  col+=flame;
  col+=L*vec3(1.0,0.7,0.5)*flare*1.6;
  vec2 sc=p/uPage;
  col*=0.70+0.30*pow(clamp(16.0*sc.x*sc.y*(1.0-sc.x)*(1.0-sc.y),0.0,1.0),0.28);
  col=aces(col*1.12);
  col=pow(col, vec3(1.0/2.2));
  o=vec4(col,1.0);
}`;

export const METAL_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uS; uniform vec2 uOff;   // metal canvas origin in fx coordinates (CSS px)
uniform float uOldHeat[8];
uniform vec3 uAmb;
${SCENE}
${COMMON}
${ATLAS}
out vec4 o;
vec2 worley(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8.0, d2=8.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 b=vec2(float(x),float(y)); vec2 r=b+hash22(i+b)-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; }
  return sqrt(vec2(d1,d2)); }
vec3 shade(float heat, float core, vec3 n, vec2 sp, float seed){
  float n1=fbm4(sp*0.8+seed);
  vec2 w=worley(sp*1.9+vec2(n1*1.2, -n1)+seed*0.37);
  float crack=1.0-smoothstep(0.01,0.06,w.y-w.x);
  float skinAmt=clamp((1.10-heat)*1.35,0.0,1.0);
  float thr=0.80-0.26*skinAmt;
  float skin=smoothstep(thr-0.08, thr+0.08, n1+0.06*(1.0-core))*smoothstep(0.0,0.2,skinAmt);
  float T=heat*(0.80+0.28*core);
  float mott=fbm3(sp*2.6+seed*1.7);
  float Ts=T*(1.0-0.36*skin)*(0.95+0.10*mott)+crack*skin*T*0.32;
  Ts*=0.97+0.06*vnoise(sp*3.0+seed);
  float liq=smoothstep(0.80,1.1,heat);
  float conv=fbm3(sp*0.9+vec2(seed, -uTime*0.7));
  Ts+=liq*(conv-0.5)*0.30;
  Ts=min(Ts, 1.02+0.08*conv);
  Ts*=0.97+0.03*sin(uTime*8.0+sp.x*4.0+seed);
  vec3 emis=blackbody(Ts);
  vec3 Ld=normalize(vec3(-0.45,-0.75,0.5));
  float diff=max(dot(n,Ld),0.0);
  vec3 H=normalize(Ld+vec3(0.0,0.0,1.0));
  float spec=pow(max(dot(n,H),0.0),36.0);
  vec3 iron=vec3(0.050,0.044,0.040)*(0.55+0.9*n1)*(1.0-0.35*crack*skin);
  float cold=uFx.z;
  vec3 lit=iron*(uAmb*1.4+vec3(0.06,0.055,0.05)*diff*(1.0+3.0*cold)+0.012+0.05*cold)+spec*(uAmb*0.9+vec3(0.03)+vec3(0.09,0.08,0.075)*cold)*(0.35+0.65*skin);
  emis+=blackbody(0.34)*crack*skin*0.22*cold*(0.75+0.25*sin(uTime*0.0+seed));
  return emis+lit;
}
void main(){
  vec2 pc=vec2(gl_FragCoord.x, uRes.y-gl_FragCoord.y)/uS;
  vec2 p=pc+uOff;
  float F=uGeo.x, by=uGeo.y;
  float cold=uFx.z;
  // a colon dot?
  for(int c=0;c<3;c++){
    vec4 C=uColon[c]; if(C.y<0.5 || abs(p.x-C.x)>0.16*F) continue;
    float r=0.055*F;
    vec2 d0=p-vec2(C.x, by-0.52*F), d1=p-vec2(C.x, by-0.20*F);
    vec2 v=(dot(d0,d0)<dot(d1,d1)? d0 : d1)/r;
    float rr=min(dot(v,v),1.0);
    vec3 n=normalize(vec3(v*0.9, sqrt(1.0-rr)+0.05));
    vec3 col=shade(C.z, sqrt(1.0-rr), n, v*0.6+float(c)*3.1, float(c)*5.7);
    col=pow(aces(col*1.12), vec3(1.0/2.2));
    o=vec4(col,1.0); return;
  }
  int k=0; float best=1e9;
  for(int i=0;i<8;i++){ if(uSlot[i].y<0.0) continue; float d=abs(p.x-uSlot[i].x); if(d<best){ best=d; k=i; } }
  vec4 S=uSlot[k], X=uAux[k];
  vec2 l=(p-vec2(S.x,by))/F;
  float dig=S.y, heat=S.z+X.y, alpha=1.0, surf=0.0;
  float pour=X.z;
  if(pour<1.0){
    float pe=1.0-pow(1.0-pour,2.2);
    float fy=-(CAP+0.03)*pe+0.010*sin(l.x*38.0+uTime*34.0)*(1.0-pe)+0.004*sin(l.x*91.0-uTime*51.0);
    if(l.y>fy){                       // already filled with the new, liquid metal
      heat=1.22;
      alpha=smoothstep(0.30,0.62, glyph(dig,l).r);
      surf=exp(-pow((l.y-fy)/0.018,2.0));
    } else {                          // the old digit still stands above the rising metal
      dig=X.w; heat=uOldHeat[k];
      alpha=dig<0.0? 0.0 : smoothstep(0.30,0.62, glyph(dig,l).r);
    }
  }
  vec4 g=glyph(dig,l);
  float e=1.6/uAtl.z;
  float gx=glyph(dig,l+vec2(e,0.0)).g-glyph(dig,l-vec2(e,0.0)).g;
  float gy=glyph(dig,l+vec2(0.0,e)).g-glyph(dig,l-vec2(0.0,e)).g;
  vec3 n=normalize(vec3(-gx*2.6, -gy*2.6, 1.0));
  float core=smoothstep(0.30,0.98,g.a);
  vec3 col=shade(heat, core, n, l*8.0, float(k)*7.31+dig*3.17);
  col+=blackbody(1.15)*surf*0.9;
  float rim=1.0-smoothstep(0.40,0.70,g.g);
  col+=blackbody(min(heat*1.05+0.18,1.05))*rim*0.22*(1.0-cold);
  col+=blackbody(1.0)*X.x*0.35*core;
  col=pow(aces(col*1.12), vec3(1.0/2.2));
  o=vec4(col*alpha, alpha);
}`;

export const EMBER_VS = `#version 300 es
precision highp float;
in vec4 aSeed;
uniform vec2 uPage;
uniform vec4 uCount;        // sparks, embers, bokeh, splash per slot
uniform float uChange[8];   // clock time each slot was last poured
uniform float uSplash[8];   // splash size per slot (0..1)
uniform float uEndT;        // clock time the sale ended (embers born after it never appear)
uniform vec3 uPtr;          // pointer x, y, strength
${SCENE}
${COMMON}
out vec3 vCol; out vec2 vQ; out float vHalf; out float vKind;
const vec2 Q[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(1,1),vec2(-1,-1),vec2(1,1),vec2(-1,1));
float heatAt(float x){
  float h=0.0, w=0.0, F=uGeo.x;
  for(int i=0;i<8;i++){ vec4 S=uSlot[i]; if(S.y<0.0) continue; float k=exp(-pow((x-S.x)/(0.42*F),4.0)); h+=k*(S.z+uAux[i].y); w+=k; }
  for(int c=0;c<3;c++){ vec4 C=uColon[c]; if(C.y<0.5) continue; float k=exp(-pow((x-C.x)/(0.2*F),4.0))*0.6; h+=k*C.z; w+=k; }
  return w>0.001? h/max(w,1.0) : 0.0;
}
void main(){
  vec2 c=Q[gl_VertexID];
  int id=gl_InstanceID;
  float F=uGeo.x, by=uGeo.y, cap=CAP*F, sc=F/214.0, fin=uFx.x;
  int nS=int(uCount.x), nE=int(uCount.y), nB=int(uCount.z), nP=int(uCount.w);
  vec2 pos=vec2(-999.0), vel=vec2(0.0,-1.0); vec3 col=vec3(0.0); float size=1.0, kind=0.0;
  if(id<nS+nE){
    bool spark=id<nS;
    float speed=1.0+0.7*fin;
    float period=spark? mix(1.5,3.0,aSeed.x) : mix(3.2,6.4,aSeed.x);
    float tt=uTime*speed+aSeed.y*period;
    float cyc=floor(tt/period);
    float life=period/speed, age=(tt-cyc*period)/speed, u=age/life;
    float birth=uTime-age;
    float h0=hash11(aSeed.z*91.7+cyc*1.618), h1=hash11(aSeed.w*53.1+cyc*2.414), h2=hash11(aSeed.x*17.3+cyc*3.33), h3=hash11(aSeed.y*7.7+cyc*5.1);
    float x0=mix(uGeo.z, uGeo.w, h0);
    float ht=heatAt(x0);
    float dens=spark? (0.40+0.60*fin) : (0.46+0.54*fin);
    float gate=step(h1, dens*clamp(ht*1.25,0.0,1.0))*step(birth, uEndT);
    vec2 p0=vec2(x0, by-cap*(0.15+0.85*h2));
    vec2 v0=(spark? vec2((h3-0.5)*70.0, -(120.0+170.0*h1)) : vec2((h3-0.5)*34.0, -(38.0+52.0*h2)))*sc*(1.0+0.45*fin);
    float sw=(spark? 9.0 : 24.0)*sc, ph=h3*6.2832;
    pos=p0+v0*age+vec2(0.0,-14.0*sc)*age*age+vec2(sin(age*1.9+ph)*sw*min(age,1.5), 0.0);
    pos.x+=(vnoise(pos*0.007+vec2(h0*9.0, uTime*0.35))-0.5)*46.0*sc*age;
    vel=v0+vec2(cos(age*1.9+ph)*1.9*sw, -28.0*sc*age);
    float fade=smoothstep(0.0,0.05,u)*pow(1.0-u, spark? 1.7 : 1.15);
    float fl=spark? 1.0 : 0.5+0.5*sin(uTime*(6.0+10.0*h0)+h1*40.0);
    float temp=spark? mix(1.02,0.55,u) : mix(0.86,0.42,u);
    col=blackbody(temp)*fade*fl*gate*(0.55+0.75*ht)*(spark? 1.25 : 1.6);
    size=(spark? mix(0.9,1.7,h2) : mix(1.5,2.8,h0))*mix(1.0,1.3,sc);
  } else if(id<nS+nE+nB){
    float period=mix(9.0,16.0,aSeed.x);
    float tt=uTime+aSeed.y*period, cyc=floor(tt/period), age=tt-cyc*period, u=age/period;
    float h0=hash11(aSeed.z*13.1+cyc*1.7), h1=hash11(aSeed.w*29.3+cyc*2.9);
    float birth=uTime-age;
    float x0=mix(uGeo.z-0.4*F, uGeo.w+0.4*F, h0);
    pos=vec2(x0+sin(age*0.5+h1*6.0)*30.0*sc, by+0.2*F-(by*1.05)*u);
    vel=vec2(0.0,-1.0);
    float fade=smoothstep(0.0,0.15,u)*smoothstep(1.0,0.6,u)*step(birth,uEndT);
    col=blackbody(0.6)*0.028*fade*(0.6+0.4*h1)*(1.0+1.2*fin);
    size=mix(9.0,24.0,h1)*sc+4.0; kind=1.0;
  } else {
    int j=id-(nS+nE+nB); int s=j/nP; int k=j-s*nP;
    vec4 S=uSlot[s];
    float t=uTime-uChange[s];
    float h0=hash11(aSeed.x*71.3+uChange[s]), h1=hash11(aSeed.y*37.9+uChange[s]), h2=hash11(aSeed.z*19.1+uChange[s]), h3=hash11(aSeed.w*5.3+uChange[s]);
    float life=0.45+0.65*h3;
    if(S.y>=0.0 && t>=0.0 && t<life && float(k)<uSplash[s]*float(nP)){
      vec2 p0=vec2(S.x+(h0-0.5)*0.44*F, by-cap*(0.5+0.5*h1));
      vec2 v0=vec2((h2-0.5)*2.0*210.0, -(170.0+300.0*h3))*sc;
      float g=760.0*sc;
      pos=p0+v0*t+0.5*vec2(0.0,g)*t*t;
      vel=v0+vec2(0.0,g*t);
      float u=t/life;
      col=blackbody(mix(1.12,0.6,u))*pow(1.0-u,1.4)*1.15;
      size=mix(1.0,2.0,h1)*mix(1.0,1.25,sc);
    }
  }
  vec2 d=pos-uPtr.xy; float dl=length(d)+1.0;
  float f=uPtr.z*exp(-dot(d,d)/(130.0*130.0));
  pos+=(d/dl*64.0+vec2(-d.y,d.x)/dl*44.0)*f;
  float sp=length(vel); vec2 dir=sp>1.0? vel/sp : vec2(0.0,-1.0);
  float half_=kind>0.5? 0.0 : max(0.0, sp*0.012/size);
  float pad=kind>0.5? 1.0 : 3.2;
  vec2 perp=vec2(-dir.y,dir.x);
  vec2 w=pos+dir*c.y*(half_+pad)*size+perp*c.x*pad*size;
  vQ=vec2(c.x*pad, c.y*(half_+pad)); vHalf=half_; vKind=kind;
  vCol=col/(1.0+half_*0.35);
  if(dot(col,col)<1e-7) w=vec2(-9999.0);
  gl_Position=vec4(w.x/uPage.x*2.0-1.0, 1.0-w.y/uPage.y*2.0, 0.0, 1.0);
}`;

export const EMBER_FS = `#version 300 es
precision highp float;
in vec3 vCol; in vec2 vQ; in float vHalf; in float vKind;
out vec4 o;
void main(){
  float I;
  if(vKind>0.5){ float r=length(vQ); I=smoothstep(1.0,0.55,r); }
  else { float yy=max(abs(vQ.y)-vHalf,0.0); float d2=vQ.x*vQ.x+yy*yy; I=exp(-d2*2.4)+exp(-d2*0.45)*0.22; }
  o=vec4(vCol*I, 0.0);
}`;

// the half-resolution scene, upsampled to the fx canvas (+ film grain at full resolution)
export const BLIT_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene; uniform vec2 uRes; uniform float uTime;
out vec4 o;
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec3 c=texture(uScene, gl_FragCoord.xy/uRes).rgb;
  c+=(hash12(gl_FragCoord.xy+fract(uTime*7.0)*91.0)-0.5)*0.012;
  o=vec4(c,1.0);
}`;
