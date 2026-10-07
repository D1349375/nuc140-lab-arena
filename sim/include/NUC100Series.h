#ifndef ARENA_NUC100SERIES_H
#define ARENA_NUC100SERIES_H
#include <stdint.h>
#define __IO volatile
#define __I volatile const
#define __O volatile
#define __STATIC_INLINE static inline
typedef struct { volatile uint32_t PMD, OFFD, DOUT, DMASK, PIN, DBEN, IMD, IEN, ISRC; } GPIO_T;
GPIO_T *arena_port(unsigned port);
volatile uint32_t *arena_pin(unsigned port, unsigned pin);
void GPIO_SetMode(GPIO_T *port, uint32_t mask, uint32_t mode);
void CLK_SysTickDelay(uint32_t us);
void CLK_SysTickLongDelay(uint32_t us);
void SYS_Init(void);
#define GPIO_PIN_DATA(port,pin) (*arena_pin((port),(pin)))
#define GPIO_MODE_INPUT 0u
#define GPIO_MODE_OUTPUT 1u
#define GPIO_MODE_OPEN_DRAIN 2u
#define GPIO_MODE_QUASI 3u
#define GPIO_PMD_INPUT GPIO_MODE_INPUT
#define GPIO_PMD_OUTPUT GPIO_MODE_OUTPUT
#define GPIO_PMD_OPEN_DRAIN GPIO_MODE_OPEN_DRAIN
#define GPIO_PMD_QUASI GPIO_MODE_QUASI
#define BIT0 (1u << 0)
#define BIT1 (1u << 1)
#define BIT2 (1u << 2)
#define BIT3 (1u << 3)
#define BIT4 (1u << 4)
#define BIT5 (1u << 5)
#define BIT6 (1u << 6)
#define BIT7 (1u << 7)
#define BIT8 (1u << 8)
#define BIT9 (1u << 9)
#define BIT10 (1u << 10)
#define BIT11 (1u << 11)
#define BIT12 (1u << 12)
#define BIT13 (1u << 13)
#define BIT14 (1u << 14)
#define BIT15 (1u << 15)
#define PA (arena_port(0))
#define PA0 GPIO_PIN_DATA(0,0)
#define PA1 GPIO_PIN_DATA(0,1)
#define PA2 GPIO_PIN_DATA(0,2)
#define PA3 GPIO_PIN_DATA(0,3)
#define PA4 GPIO_PIN_DATA(0,4)
#define PA5 GPIO_PIN_DATA(0,5)
#define PA6 GPIO_PIN_DATA(0,6)
#define PA7 GPIO_PIN_DATA(0,7)
#define PA8 GPIO_PIN_DATA(0,8)
#define PA9 GPIO_PIN_DATA(0,9)
#define PA10 GPIO_PIN_DATA(0,10)
#define PA11 GPIO_PIN_DATA(0,11)
#define PA12 GPIO_PIN_DATA(0,12)
#define PA13 GPIO_PIN_DATA(0,13)
#define PA14 GPIO_PIN_DATA(0,14)
#define PA15 GPIO_PIN_DATA(0,15)
#define PB (arena_port(1))
#define PB0 GPIO_PIN_DATA(1,0)
#define PB1 GPIO_PIN_DATA(1,1)
#define PB2 GPIO_PIN_DATA(1,2)
#define PB3 GPIO_PIN_DATA(1,3)
#define PB4 GPIO_PIN_DATA(1,4)
#define PB5 GPIO_PIN_DATA(1,5)
#define PB6 GPIO_PIN_DATA(1,6)
#define PB7 GPIO_PIN_DATA(1,7)
#define PB8 GPIO_PIN_DATA(1,8)
#define PB9 GPIO_PIN_DATA(1,9)
#define PB10 GPIO_PIN_DATA(1,10)
#define PB11 GPIO_PIN_DATA(1,11)
#define PB12 GPIO_PIN_DATA(1,12)
#define PB13 GPIO_PIN_DATA(1,13)
#define PB14 GPIO_PIN_DATA(1,14)
#define PB15 GPIO_PIN_DATA(1,15)
#define PC (arena_port(2))
#define PC0 GPIO_PIN_DATA(2,0)
#define PC1 GPIO_PIN_DATA(2,1)
#define PC2 GPIO_PIN_DATA(2,2)
#define PC3 GPIO_PIN_DATA(2,3)
#define PC4 GPIO_PIN_DATA(2,4)
#define PC5 GPIO_PIN_DATA(2,5)
#define PC6 GPIO_PIN_DATA(2,6)
#define PC7 GPIO_PIN_DATA(2,7)
#define PC8 GPIO_PIN_DATA(2,8)
#define PC9 GPIO_PIN_DATA(2,9)
#define PC10 GPIO_PIN_DATA(2,10)
#define PC11 GPIO_PIN_DATA(2,11)
#define PC12 GPIO_PIN_DATA(2,12)
#define PC13 GPIO_PIN_DATA(2,13)
#define PC14 GPIO_PIN_DATA(2,14)
#define PC15 GPIO_PIN_DATA(2,15)
#define PD (arena_port(3))
#define PD0 GPIO_PIN_DATA(3,0)
#define PD1 GPIO_PIN_DATA(3,1)
#define PD2 GPIO_PIN_DATA(3,2)
#define PD3 GPIO_PIN_DATA(3,3)
#define PD4 GPIO_PIN_DATA(3,4)
#define PD5 GPIO_PIN_DATA(3,5)
#define PD6 GPIO_PIN_DATA(3,6)
#define PD7 GPIO_PIN_DATA(3,7)
#define PD8 GPIO_PIN_DATA(3,8)
#define PD9 GPIO_PIN_DATA(3,9)
#define PD10 GPIO_PIN_DATA(3,10)
#define PD11 GPIO_PIN_DATA(3,11)
#define PD12 GPIO_PIN_DATA(3,12)
#define PD13 GPIO_PIN_DATA(3,13)
#define PD14 GPIO_PIN_DATA(3,14)
#define PD15 GPIO_PIN_DATA(3,15)
#define PE (arena_port(4))
#define PE0 GPIO_PIN_DATA(4,0)
#define PE1 GPIO_PIN_DATA(4,1)
#define PE2 GPIO_PIN_DATA(4,2)
#define PE3 GPIO_PIN_DATA(4,3)
#define PE4 GPIO_PIN_DATA(4,4)
#define PE5 GPIO_PIN_DATA(4,5)
#define PE6 GPIO_PIN_DATA(4,6)
#define PE7 GPIO_PIN_DATA(4,7)
#define PE8 GPIO_PIN_DATA(4,8)
#define PE9 GPIO_PIN_DATA(4,9)
#define PE10 GPIO_PIN_DATA(4,10)
#define PE11 GPIO_PIN_DATA(4,11)
#define PE12 GPIO_PIN_DATA(4,12)
#define PE13 GPIO_PIN_DATA(4,13)
#define PE14 GPIO_PIN_DATA(4,14)
#define PE15 GPIO_PIN_DATA(4,15)
extern uint32_t SystemCoreClock, CyclesPerUs;
void SystemCoreClockUpdate(void);
#endif
