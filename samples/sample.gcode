; Sample gcode for testing the CNC Speeds & Feeds Analyzer
; Tool 1: Amana 46202-K (1/4" down-cut, 2 flutes, 180 IPM, 0.005 chip load)
; Tool 2: Amana 46282-K (1/16" tapered ball tip, 4 flutes, 35-45 IPM)
; Tool 3: Amana 51766 (1/8" up-cut, 2 flutes, 70-110 IPM)

G90 G94 G17
G21

(Tool: Amana 46202-K)
T1 M6
S18000 M3
G0 X0 Y0 Z0.5
G1 Z-0.125 F180
G1 X10 Y0 F180
G1 X10 Y10 F180
G1 X0 Y10 F180
G1 X0 Y0 F180
G0 Z0.5

(Tool: Amana 46282-K)
T2 M6
S18000 M3
G0 X5 Y5 Z0.5
G1 Z-0.03 F50
G1 X5.1 Y5 F50
G1 X5.1 Y5.1 F50
G0 Z0.5

(Tool: Amana 51766)
T3 M6
S12000 M3
G0 X2 Y2 Z0.5
G1 Z-0.006 F130
G1 X8 Y2 F130
G1 X8 Y8 F130
G0 Z0.5

(Tool: Amana 45704)
T4 M6
S16000 M3
G0 X0 Y0 Z0.5
G1 Z-0.0024 F90
G1 X3 Y0 F90
G0 Z0.5

M5
M30