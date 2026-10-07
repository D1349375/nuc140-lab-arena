"""Independent classroom-style C programs used to verify the whole pipeline."""
from arena.curriculum import get_template
from arena.projects import normalize_project

COMMON = r'''
#include <stdio.h>
#include "NUC100Series.h"
#include "MCU_init.h"
#include "SYS_init.h"
#include "Scankey.h"
#include "Seven_Segment.h"
#include "lab_config.h"
static void leds(unsigned mask) {
    PC12 = !(mask & 1); PC13 = !(mask & 2);
    PC14 = !(mask & 4); PC15 = !(mask & 8);
}
static void init(void) {
    SYS_Init(); GPIO_SetMode(PC, BIT12|BIT13|BIT14|BIT15, GPIO_MODE_OUTPUT);
    leds(0); OpenKeyPad(); OpenSevenSegment();
    GPIO_SetMode(PB, BIT11, GPIO_MODE_OUTPUT); PB11=1;
}
static unsigned binary(int n) {
    return ((n&8)>>3)|((n&4)>>1)|((n&2)<<1)|((n&1)<<3);
}
static void display(int n, int leading) {
    int d[4]={n%10,n/10%10,n/100%10,n/1000%10};
    int max=3;
    if(!leading) { max=0; while(max<3 && n>=10) {n/=10;max++;} }
    for(int i=0;i<4;i++) {
        CloseSevenSegment(); if(leading||i<=max) ShowSevenSegment(i,d[i]);
        CLK_SysTickDelay(500);
    }
}
'''
PROGRAMS = {
"lab1-1":r'''
int main(void) { init(); while(1) { leds(binary(LAB_STUDENT_DIGIT)); CLK_SysTickDelay(1000); } }
''',
"lab1-2":r'''
int main(void) { int i=LAB_DIRECTION==1?0:3; init();
while(1) { leds(1u<<i); CLK_SysTickDelay(150000); i=(i+LAB_DIRECTION+4)%4; } }
''',
"lab2-1":r'''
int main(void) { int date[7]=LAB_DATE_DIGITS; init();
while(1) { int key=ScanKey(); leds(key>=1&&key<=7 ? (date[key-1]?binary(date[key-1]):15) : 0); CLK_SysTickDelay(1000); } }
''',
"lab2-2":r'''
int main(void) { int prev=0,dir=0,paused=0,index=0,tick=0;
unsigned left[5]={0,1,3,7,15},right[5]={0,8,12,14,15}; init();
while(1) { int key=ScanKey();
 if(key && !prev) { if(key==1||key==3) {dir=key;index=0;tick=0;paused=0;} else if(key==2) paused=!paused; }
 prev=key;
 if(dir) {leds(dir==1?left[index]:right[index]); if(!paused && ++tick>=150) {tick=0;index=(index+1)%5;} }
 CLK_SysTickDelay(1000);
} }
''',
"lab3-1":r'''
int main(void) { int seconds=LAB_INITIAL_SECONDS, running=0,prev=0,ticks=0,alarm=0;
int period=1000,change=-5,steps=0,led=0; init();
while(1) { int key=ScanKey();
 if(key && !prev) {
   if(key==9) {seconds=LAB_INITIAL_SECONDS;running=0;ticks=0;alarm=0;leds(0);PB11=1;CloseSevenSegment();}
   else if(!alarm && key==7) running=1;
   else if(!alarm && key==8) running=0;
 } prev=key;
 if(alarm) {
   CloseSevenSegment(); leds(1u<<led);
   PB11=0; CLK_SysTickDelay(period); PB11=1; CLK_SysTickDelay(period);
   period+=change;
   if(++steps==100) {steps=0;change=-change;led=(led+1)%4;}
 } else {
   display(seconds,1);
   if(running && ++ticks>=500) {ticks=0;if(++seconds>=60) {alarm=1;period=1000;change=-5;steps=0;led=0;}}
 }
} }
''',
"lab3-2":r'''
int main(void) { int values[4],size=0,mode=0,prev=0; init();
while(1) { int key=ScanKey();
 if(key && !prev) {
   if(key>=1&&key<=6&&size<4) values[size++]=key;
   else if(key==8) mode=1;
   else if(key==9) mode=2;
   else if(key==7&&mode&&size) {
     if(mode==2) for(int i=1;i<size;i++) values[i-1]=values[i];
     size--;
   }
 } prev=key; leds(mode==1?1:mode==2?3:0);
 for(int digit=0;digit<4;digit++) {
   CloseSevenSegment(); if(digit<size) ShowSevenSegment(digit,values[size-1-digit]);
   CLK_SysTickDelay(500);
 }
} }
'''
}

def reference(lab_id, config=None):
    template=get_template(lab_id,config=config)
    template["files"]["main.c"]=COMMON+PROGRAMS[lab_id]
    template["config"]=config or {}
    return normalize_project(template)
