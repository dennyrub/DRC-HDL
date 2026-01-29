library IEEE;
use IEEE.STD_LOGIC_1164.all;
use IEEE.NUMERIC_STD.all;
use std.textio.all;
use IEEE.std_logic_textio.all;

entity processor is
    port (
        CLK : in std_logic;
        RESET : in std_logic;
        Start : in std_logic;
        Header : in std_logic_vector (8 downto 1);
        Data : in std_logic_vector (8 downto 1);
        Lacs : in std_logic_vector (32 downto 1);
        Sig : in std_logic_vector (40 downto 1);
        Result : out std_logic_vector(1 downto 0) := "00";
        Finish : out std_logic := '0'
    );
end processor;

architecture processor of processor is

    constant Z : std_logic_vector := "000000000000000000000000";
    constant P0 : std_logic_vector (60 downto 1) := "100000000000000000000000000000000000000000000000000000000000";
    constant C0 : std_logic_vector := "101010101010101010101010101010101010101010101010101010101010";

    type weights_array is array (1 to 60) of std_logic_vector (48 downto 1);
    type state is (IDLE, HASH, HKS, STOP, ERROR);
    signal fsm : state;

begin

    Main_PROC : process (CLK, RESET)
        variable X : std_logic_vector (72 downto 1);
        variable Pj : std_logic := '0';
        variable P1 : std_logic_vector (60 downto 1);
        variable S : std_logic_vector (40 downto 1);
        variable console_buf : line;
        variable ww : weights_array := (
            x"000102030405", --1
            x"060708090A0B", --2
            x"0C0D0E0F1011", --3
            x"121314151617", --4
            x"18191A1B1C1D", --5
            x"1E1F20212223", --6
            x"242526272829", --7
            x"2A2B2C2D2E2F", --8
            x"303132333435", --9
            x"363738393A3B", --10
            x"3C3D3E3F4041", --11
            x"424344454647", --12
            x"48494A4B4C4D", --13
            x"4E4F50515253", --14
            x"545556575859", --15
            x"5A5B5C5D5E5F", --16
            x"606162636465", --17
            x"666768696A6B", --18
            x"6C6D6E6F7071", --19
            x"727374757677", --20
            x"78797A7B7C7D", --21
            x"7E7F80818283", --22
            x"848586878889", --23
            x"8A8B8C8D8E8F", --24
            x"909192939495", --25
            x"969798999A9B", --26
            x"9C9D9E9FA0A1", --27
            x"A2A3A4A5A6A7", --28
            x"A8A9AAABACAD", --29
            x"AEAFB0B1B2B3", --30
            x"B4B5B6B7B8B9", --31
            x"BABBBCBDBEBF", --32
            x"C0C1C2C3C4C5", --33
            x"C6C7C8C9CACB", --34
            x"CCCDCECFD0D1", --35
            x"D2D3D4D5D6D7", --36
            x"D8D9DADBDCDD", --37
            x"DEDFE0E1E2E3", --38
            x"E4E5E6E7E8E9", --39
            x"EAEBECEDEEEF", --40
            x"F0F1F2F3F4F5", --41
            x"F6F7F8F9FAFB", --42
            x"FCFDFEFF0001", --43
            x"020304050607", --44
            x"08090A0B0C0D", --45
            x"0E0F10111213", --46
            x"141516171819", --47
            x"1A1B1C1D1E1F", --48
            x"202122232425", --49
            x"262728292A2B", --50
            x"2C2D2E2F3031", --51
            x"323334353637", --52
            x"38393A3B3C3D", --53
            x"3E3F40414243", --54
            x"444546474849", --55
            x"4A4B4C4D4E4F", --56
            x"505152535455", --57
            x"565758595A5B", --58
            x"5C5D5E5F6061", --59
            x"626364656667" --60
        );

        function PCxor(
            P : std_logic_vector (60 downto 1);
            C : std_logic_vector (60 downto 1)) return std_logic is
            variable tempxor : std_logic := '0';
        begin
            for i in 1 to 60 loop
                tempxor := tempxor xor (P(i) and C(i));
            end loop;
            return tempxor;
        end function;

        function LFSR(
            inputX : std_logic_vector (72 downto 1);
            inputP : std_logic_vector (60 downto 1)) return std_logic_vector is
            variable X : std_logic_vector (72 downto 1);
            variable P : std_logic_vector (60 downto 1);
            variable Pj : std_logic;
        begin
            X := inputX;
            P := inputP;
            for i in 1 to 72 loop
                Pj := X(73 - i) xor (PCxor(P, C0));
                P(59 downto 1) := P(60 downto 2);
                P(60) := Pj;
            end loop;
            return P;
        end function;

        function SumHKS(
            P : std_logic_vector (60 downto 1);
            Weights : weights_array) return std_logic_vector is
            variable temp_sum : std_logic_vector (48 downto 1) := x"000000000000";
        begin
            for i in 1 to 60 loop
                if P(61 - i) = '1' then
                    temp_sum := std_logic_vector(unsigned(temp_sum) + unsigned(Weights(i)));
                end if;
            end loop;
            return temp_sum(48 downto 9);
        end function;

    begin

        if RESET = '0' then
            --
        elsif rising_edge(CLK) then
            case fsm is

                when IDLE =>
                    Result <= "00";
                    Finish <= '0';
                    if Start = '1' then
                        fsm <= HASH;
                    end if;

                when HASH =>
                    X := Header & Data & LACs & Z;

                    write(console_buf, string'("    Input data value: "));
                    hwrite(console_buf, X);
                    writeline(output, console_buf);

                    P1 := LFSR(X, P0);

                    write(console_buf, string'("    Presignature P:   "));
                    hwrite(console_buf, P1);
                    writeline(output, console_buf);
                    fsm <= HKS;

                when HKS =>
                    S := SumHKS(P1, ww);
                    write(console_buf, string'("    Full Signature:   "));
                    hwrite(console_buf, S);
                    writeline(output, console_buf);
                    fsm <= STOP;

                when STOP =>
                    if S = Sig then
                        write(console_buf, string'("        VALID!"));
                        writeline(output, console_buf);
                        Finish <= '1';
                        Result <= "11";
                    else
                        write(console_buf, string'("        NOT VALID!"));
                        writeline(output, console_buf);
                        Finish <= '1';
                        Result <= "10";
                    end if;
                    write(console_buf, string'(" "));
                    writeline(output, console_buf);
                    fsm <= IDLE;

                when others =>

            end case;
        end if;
    end process;

    -- Treat_PROC : process
    --     variable X : std_logic_vector (72 downto 1);
    --     variable Pj : std_logic;
    --     variable console_buf : line;
    --     variable temp_xor : std_logic := '0';

    --     function PCxor(
    --         P : std_logic_vector (60 downto 1);
    --         C : std_logic_vector (60 downto 1)) return std_logic is
    --         variable tempxor : std_logic := '0';
    --     begin
    --         for i in 1 to 60 loop
    --             tempxor := tempxor xor (P(i) and C(i));
    --         end loop;
    --         return tempxor;
    --     end function;

    --     -- function LFSR(
    --     --     inputX : std_logic_vector (72 downto 1);
    --     --     inputP : std_logic_vector (60 downto 1)) return std_logic_vector is
    --     --     variable X : std_logic_vector (72 downto 1);
    --     --     variable P : std_logic_vector (60 downto 1);
    --     --     variable Pj : std_logic;
    --     -- begin
    --     --     X := inputX;
    --     --     P := inputP;
    --     --     for i in 72 to 1 loop
    --     --         Pj := X(i) xor (PCxor(P, C0));
    --     --         P(59 downto 1) :=  P(60 downto 2);
    --     --         P(60) :=  Pj;
    --     --     end loop;
    --     --     return P;
    --     -- end function;

    -- begin
    --     if Start = '1' then
    --        X := Header & Data & LACs & Z;

    --         write(console_buf, string'("Input data value: "));
    --         hwrite(console_buf, X);
    --         writeline(output, console_buf);

    --         write(console_buf, string'("Presignature P:   "));
    --         hwrite(console_buf, Z);
    --         writeline(output, console_buf);
    --         -- fsm <= STOP;
    --     else

    --     end if;
    -- end process;

end architecture;