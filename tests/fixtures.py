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
    int i;
    int d[4];
    int max=3;
    d[0]=n%10; d[1]=n/10%10; d[2]=n/100%10; d[3]=n/1000%10;
    if(!leading) { max=0; while(max<3 && n>=10) {n/=10;max++;} }
    for(i=0;i<4;i++) {
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
int main(void) { int values[4],size=0,mode=0,prev=0,i=0,digit=0; init();
while(1) { int key=ScanKey();
 if(key && !prev) {
   if(key>=1&&key<=6&&size<4) values[size++]=key;
   else if(key==8) mode=1;
   else if(key==9) mode=2;
   else if(key==7&&mode&&size) {
     if(mode==2) for(i=1;i<size;i++) values[i-1]=values[i];
     size--;
   }
 } prev=key; leds(mode==1?1:mode==2?3:0);
 for(digit=0;digit<4;digit++) {
   CloseSevenSegment(); if(digit<size) ShowSevenSegment(digit,values[size-1-digit]);
   CLK_SysTickDelay(500);
 }
} }
''',
"lab4-1":r'''
static void set_rgb(int mask) {
    PA14 = !(mask & 1); PA13 = !(mask & 2); PA12 = !(mask & 4);
}
static void show_iecs(void) {
    uint8_t pat[4] = {0x50, 0x1F, 0x13, 0xEE};
    uint8_t val;
    int d;
    for(d=0; d<4; d++) {
        CloseSevenSegment();
        val = pat[d];
        PE0 = (val >> 0) & 1; PE1 = (val >> 1) & 1; PE2 = (val >> 2) & 1; PE3 = (val >> 3) & 1;
        PE4 = (val >> 4) & 1; PE5 = (val >> 5) & 1; PE6 = (val >> 6) & 1; PE7 = (val >> 7) & 1;
        if(d==0) PC4=1; else if(d==1) PC5=1; else if(d==2) PC6=1; else if(d==3) PC7=1;
        CLK_SysTickDelay(500);
    }
}
volatile int trigger = 0;
void EINT1_IRQHandler(void) {
    GPIO_CLR_INT_FLAG(PB, BIT15);
    trigger = 1;
}
int main(void) {
    int colors[3] = {5, 6, 3};
    int s, t;
    init();
    GPIO_SetMode(PA, BIT12|BIT13|BIT14, GPIO_MODE_OUTPUT);
    set_rgb(0);
    GPIO_SetMode(PB, BIT15, GPIO_MODE_INPUT);
    GPIO_EnableEINT1(PB, 15, GPIO_INT_RISING);
    NVIC_EnableIRQ(EINT1_IRQn);
    CloseSevenSegment();
    while (1) {
        if (trigger) {
            trigger = 0;
            for (s = 0; s < 3; s++) {
                set_rgb(colors[s]);
                for (t = 0; t < 500; t++) {
                    show_iecs();
                }
            }
            CloseSevenSegment();
            set_rgb(0);
        }
        CLK_SysTickDelay(1000);
    }
}
''',
"lab4-2":r'''
volatile int marquee_mode = 0;
void EINT1_IRQHandler(void) {
    GPIO_CLR_INT_FLAG(PB, BIT15);
    marquee_mode = 1;
}
static void display_stopwatch(int total_seconds) {
    int minutes = total_seconds / 60;
    int secs = total_seconds % 60;
    int d0 = secs % 10;
    int d1 = secs / 10;
    int d2 = minutes % 10;
    int d3 = minutes / 10;
    CloseSevenSegment(); ShowSevenSegment(0, d0); CLK_SysTickDelay(500);
    CloseSevenSegment(); ShowSevenSegment(1, d1); CLK_SysTickDelay(500);
    CloseSevenSegment(); ShowSevenSegment(2, d2); CLK_SysTickDelay(500);
    CloseSevenSegment(); ShowSevenSegment(3, d3); CLK_SysTickDelay(500);
}
int main(void) {
    int seconds = 0, running = 0, prev = 0, ticks = 0;
    uint8_t m_pat[6] = {0xF7, 0xEF, 0xFE, 0xDF, 0xBF, 0xFB};
    int m_idx = 0, m_ticks = 0;
    int key;
    uint8_t val;
    init();
    GPIO_SetMode(PB, BIT15, GPIO_MODE_INPUT);
    GPIO_EnableEINT1(PB, 15, GPIO_INT_RISING);
    NVIC_EnableIRQ(EINT1_IRQn);
    while (1) {
        key = ScanKey();
        if (marquee_mode) {
            if (key && !prev) {
                marquee_mode = 0;
            }
            val = m_pat[m_idx];
            PE0 = (val >> 0) & 1; PE1 = (val >> 1) & 1; PE2 = (val >> 2) & 1; PE3 = (val >> 3) & 1;
            PE4 = (val >> 4) & 1; PE5 = (val >> 5) & 1; PE6 = (val >> 6) & 1; PE7 = (val >> 7) & 1;
            PC4 = 1; PC5 = 1; PC6 = 1; PC7 = 1;
            CLK_SysTickDelay(2000);
            if (++m_ticks >= 75) {
                m_ticks = 0;
                m_idx = (m_idx + 1) % 6;
            }
        } else {
            if (key && !prev) {
                if (key == 1) running = 1;
                else if (key == 2) running = 0;
                else if (key == 3) { seconds = 0; running = 0; }
                else if (key == 4) seconds += 50;
            }
            display_stopwatch(seconds);
            if (running && ++ticks >= 500) {
                ticks = 0;
                seconds++;
            }
        }
        prev = key;
    }
}
'''
}

def reference(lab_id, config=None):
    template=get_template(lab_id,config=config)
    template["files"]["main.c"]=COMMON+PROGRAMS[lab_id]
    template["config"]=config or {}
    return normalize_project(template)
