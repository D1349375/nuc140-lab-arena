/* Native C peripheral model. Student and board-driver sources are compiled,
 * never interpreted as text. This is not a Cortex-M0 instruction emulator. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include "NUC100Series.h"
#include "MCU_init.h"

static GPIO_T ports[5];
static uint32_t latch[5];
static volatile uint32_t pin_cells[5][16];
static int pending_port = -1, pending_pin = -1;
static uint32_t pending_value;
static uint64_t now_us, goal_us, frame_start;
static unsigned key_mask, led_mask, previous_buzz = 1;
static uint64_t segment_time[4][8], buzz_time, last_falling;
static double frequency;
struct event { uint64_t time; unsigned value; };
static struct event led_events[256], buzz_events[512];
static unsigned led_count, buzz_count;
static const unsigned segment_pins[8] = {3,4,0,5,6,2,7,1};
uint32_t SystemCoreClock = MCU_CLOCK_FREQUENCY;
uint32_t CyclesPerUs = MCU_CLOCK_FREQUENCY / 1000000u;

static unsigned mode(unsigned port, unsigned pin) {
    return (ports[port].PMD >> (pin * 2u)) & 3u;
}
static unsigned output(unsigned port, unsigned pin) {
    return mode(port,pin) != GPIO_MODE_INPUT && ((latch[port] >> pin) & 1u) == 0;
}
static uint32_t physical(unsigned port) {
    uint32_t value = latch[port];
    if (port == 0) {
        /* Keys 1/4/7 connect PA2 to PA3/4/5, 2/5/8 PA1, 3/6/9 PA0. */
        for (unsigned key=1; key<=9; ++key) {
            unsigned column = 2u - ((key-1u) % 3u), row = 3u + ((key-1u) / 3u);
            if ((key_mask & (1u << (key-1u))) && output(0,column)) value &= ~(1u << row);
        }
    }
    return value & 0xffffu;
}
static void flush(void) {
    if (pending_port >= 0) {
        uint32_t value = pin_cells[pending_port][pending_pin];
        if (value != pending_value) {
            uint32_t bit = 1u << pending_pin;
            if (value) latch[pending_port] |= bit; else latch[pending_port] &= ~bit;
            ports[pending_port].DOUT = latch[pending_port];
        }
        pending_port = -1;
    }
    for (unsigned p=0; p<5; ++p) {
        latch[p] = ports[p].DOUT & 0xffffu;
        ports[p].PIN = physical(p);
    }
    unsigned mask=0;
    for (unsigned i=0; i<4; ++i) if (output(2,12+i)) mask |= 1u << i;
    if (mask != led_mask) {
        led_mask=mask;
        if (led_count<256) led_events[led_count++] = (struct event){now_us,mask};
    }
    unsigned buzz = output(1,11) ? 0u : 1u;
    if (buzz != previous_buzz) {
        if (buzz_count<512) buzz_events[buzz_count++] = (struct event){now_us,buzz};
        if (buzz == 0) {
            if (last_falling && now_us > last_falling) frequency=1000000.0/(now_us-last_falling);
            last_falling=now_us;
        }
        previous_buzz=buzz;
    }
}
static void integrate(uint64_t duration) {
    for (unsigned digit=0; digit<4; ++digit) {
        /* Digit enables PC4..7 are active high. Segment PE pins active low. */
        if (mode(2,4+digit) != GPIO_MODE_INPUT && ((latch[2] >> (4+digit)) & 1u))
            for (unsigned segment=0; segment<8; ++segment)
                if (output(4,segment_pins[segment])) segment_time[digit][segment] += duration;
    }
    if (output(1,11)) buzz_time += duration;
}
static void emit_frame(int finished) {
    uint64_t duration = now_us-frame_start;
    if (!duration) duration=1;
    printf("\n@NUC140_FRAME {\"timeUs\":%" PRIu64 ",\"ledMask\":%u,\"leds\":[",now_us,led_mask);
    for (unsigned i=0;i<4;++i) printf("%s%u",i?",":"",(led_mask>>i)&1u);
    printf("],\"segments\":[");
    for (int digit=3;digit>=0;--digit) {
        unsigned mask=0;
        for (unsigned seg=0;seg<8;++seg) if (segment_time[digit][seg]*100u >= duration) mask |= 1u << seg;
        printf("%s{\"mask\":%u,\"duty\":[",digit==3?"":",",mask);
        for (unsigned seg=0;seg<8;++seg) printf("%s%.4f",seg?",":"",(double)segment_time[digit][seg]/duration);
        printf("]}");
    }
    double hz = (last_falling && now_us-last_falling<100000u) ? frequency : 0.0;
    printf("],\"buzzer\":{\"active\":%s,\"frequency\":%.2f,\"duty\":%.4f},\"keyMask\":%u,\"events\":[",
           buzz_time ? "true":"false",hz,(double)buzz_time/duration,key_mask);
    for (unsigned i=0;i<led_count;++i) printf("%s{\"timeUs\":%" PRIu64 ",\"ledMask\":%u}",i?",":"",led_events[i].time,led_events[i].value);
    printf("],\"buzzerEdges\":[");
    for (unsigned i=0;i<buzz_count;++i) printf("%s[%" PRIu64 ",%u]",i?",":"",buzz_events[i].time,buzz_events[i].value);
    printf("],\"finished\":%s}\n",finished?"true":"false");
    fflush(stdout);
    memset(segment_time,0,sizeof(segment_time));
    buzz_time=0;led_count=0;buzz_count=0;frame_start=now_us;
}
static void read_command(void) {
    char line[128]; unsigned keys, budget;
    if (!fgets(line,sizeof(line),stdin)) exit(0);
    if (sscanf(line,"%u %u",&keys,&budget)!=2) exit(2);
    if (budget<1000u || budget>100000u) exit(2);
    key_mask=keys&511u; goal_us=now_us+budget;
    for(unsigned p=0;p<5;++p) ports[p].PIN=physical(p);
}
static void advance(uint64_t duration) {
    flush();
    while (duration) {
        uint64_t part=duration;
        if (part>goal_us-now_us) part=goal_us-now_us;
        integrate(part); now_us+=part; duration-=part;
        if (now_us==goal_us) { emit_frame(0); read_command(); }
    }
}
volatile uint32_t *arena_pin(unsigned port,unsigned pin) {
    if (port>=5 || pin>=16) { fputs("Invalid GPIO pin\n",stderr); exit(2); }
    advance(1);
    pending_value=(physical(port)>>pin)&1u;
    pin_cells[port][pin]=pending_value;
    pending_port=(int)port;pending_pin=(int)pin;
    return &pin_cells[port][pin];
}
GPIO_T *arena_port(unsigned port) {
    if (port>=5) exit(2);
    advance(1); return &ports[port];
}
void GPIO_SetMode(GPIO_T *port,uint32_t mask,uint32_t value) {
    if (value>3u) { fputs("Invalid GPIO mode\n",stderr); exit(2); }
    advance(1);
    for(unsigned pin=0;pin<16;++pin) if (mask&(1u<<pin)) {
        port->PMD=(port->PMD&~(3u<<(2u*pin)))|(value<<(2u*pin));
    }
}
void CLK_SysTickDelay(uint32_t us) { advance(us ? us : 1u); }
void CLK_SysTickLongDelay(uint32_t us) { advance(us ? us : 1u); }
void SYS_Init(void) { advance(1); }
void SystemCoreClockUpdate(void) { SystemCoreClock=MCU_CLOCK_FREQUENCY;CyclesPerUs=SystemCoreClock/1000000u; }
extern int arena_user_main(void);
int main(void) {
    setvbuf(stdout,NULL,_IONBF,0);
    for(unsigned p=0;p<5;++p) { ports[p].PMD=0xffffffffu;ports[p].DOUT=0xffffu;latch[p]=0xffffu;ports[p].PIN=0xffffu; }
    emit_frame(0);read_command();
    int result=arena_user_main();
    flush();integrate(1);++now_us;emit_frame(1);
    return result;
}
