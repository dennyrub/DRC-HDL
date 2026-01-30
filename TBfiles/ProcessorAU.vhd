--  VER 17.2
--                                  ������� ��������
--  Result:                                         FAR:
--  00 - 0000 0000 - ��� ������� Start              4 - 100 - No authentication report (or �Cold Start�) 
--  01 - 0000 0001 - AU ���������                   4 - 100 - No authentication report (or �Cold Start�) 
--  02 - 0000 0011 - AU �����. �������� Sig         4 - 100 - Error in Signature
--  03 - 0000 0010 - AU �����. �������� LAC         5 - 101 - Error in LAC
--  04 - 0000 0100 - Dummy                          3 - 011 - Authorised �dummy segment�
--  14 - 0001 0100 - Data Segment                   1 - 001 - Authorised data segment
--  24 - 0010 0100 - �������� ������ ������� ���    6 - 110 - Wrong format (not executable) of authorised Authentication Control Command (includes Segment Header)
--  34 - 0111 0100 - �������� ������ ������         7 - 111 - Wrong length of TC Segment prior to being authenticated (authorised), i.e. length shorter than 10 octets
--  54 - 0101 0100 - Select Fix Key                 2 - 010 - Authorised (and executable) Authentication Control Command
--  64 - 0110 0100 - Select Prog Key                2 - 010 - Authorised (and executable) Authentication Control Command
--  74 - 0111 0100 - Load Fix Key                   2 - 010 - Authorised (and executable) Authentication Control Command
--  94 - 1001 0100 - Set new LAC                    2 - 010 - Authorised (and executable) Authentication Control Command
--  A4 - 1010 0100 - Change Prog Key A              2 - 010 - Authorised (and executable) Authentication Control Command
--  B4 - 1011 0100 - Change Prog Key B              2 - 010 - Authorised (and executable) Authentication Control Command

library IEEE;
use IEEE.numeric_std.all;
use IEEE.std_logic_1164.all;
use IEEE.std_logic_textio.all;
use std.textio.all;

entity ProcessorAU is
    port (
        CLK : in STD_LOGIC;
        RESET : in STD_LOGIC;
        Start : in STD_LOGIC;
        EnAU : in STD_LOGIC;
        D_TC : in STD_LOGIC_VECTOR(7 downto 0);
        D_K : in STD_LOGIC_VECTOR(7 downto 0);
        Busy : out STD_LOGIC;
        Finish : out STD_LOGIC;
        Result : out STD_LOGIC_VECTOR(7 downto 0);
        ReportMes : out STD_LOGIC_VECTOR(0 to 79);
        ChipSelect : out STD_LOGIC;
        SelMem : out STD_LOGIC;
        Adr_K : out STD_LOGIC_VECTOR(9 downto 0); 
        Adr_D : out STD_LOGIC_VECTOR(8 downto 0);
        Adr_WK : out STD_LOGIC_VECTOR(9 downto 0);
        D_WK : out STD_LOGIC_VECTOR(7 downto 0);
        EnW : out STD_LOGIC;
        FAR2830 : out STD_LOGIC_VECTOR(2 downto 0);
        -------------------------------------------------------------------------------------------
        Res_Start_FL : out STD_LOGIC;
        Sync_Disable : in STD_LOGIC;
        Answer_Arbiter : in STD_LOGIC
    );
end entity;

architecture ProcessorAU of ProcessorAU is

    constant W_MIN_ADR : NATURAL := 512;
    constant W_MAX_ADR : NATURAL := 359 + W_MIN_ADR;
    constant Z : STD_LOGIC_VECTOR := x"00";
    constant P0 : STD_LOGIC_VECTOR(60 downto 1) := x"800000000000000";
    type state is (
        IDLE, STOP, COM, REP, ERROR,
        TACT_INIT, INIT,
        TACT_RC, RC,
        TACT_RD, RD, HASH,
        TACT_RW, RW, HKS,
        SET_ADR_WK, TACT_LR, SET_D_WK, WK,
        SELCURMEM, RGCC, TACT_RGCC,
        SET_ADR_LR, SET_D_TC_LR, LR
    );
    signal FSM : state;

begin
    Main_PROC : process (CLK, RESET)
        variable console_buf : line := null;
        variable len_reg : NATURAL range 0 to 256 := 0;
        variable gcc_reg : STD_LOGIC_VECTOR(1 to 24) := (others => '0');
        variable flag_changePK : BOOLEAN := false;
        variable temp_result : STD_LOGIC_VECTOR (7 downto 0) := x"00";

        variable lac_board : STD_LOGIC_VECTOR(1 to 96) := x"3FFFFFFF7FFFFFFFBFFFFFFF";
        variable lac_ground : STD_LOGIC_VECTOR(1 to 32) := (others => '0');
        variable lac_new : STD_LOGIC_VECTOR(1 to 32) := (others => '0');
        variable s_board : STD_LOGIC_VECTOR(0 to 47) := (others => '0');
        variable s_ground : STD_LOGIC_VECTOR(40 downto 1) := (others => '0');

        variable current_mem : STD_LOGIC := '0';
        variable d_reg : STD_LOGIC_VECTOR(8 downto 1) := (others => '0');
        variable w_reg : STD_LOGIC_VECTOR(1 to 48) := (others => '0');
        variable adr_d_cnt : NATURAL range 0 to 512 := 3;
        variable adr_k_cnt : NATURAL range 0 to 1024 := W_MIN_ADR;
        variable adr_w_cnt : NATURAL range 0 to 1024 := W_MIN_ADR;
        variable offset_adrw : NATURAL := 0;

        variable C0 : STD_LOGIC_VECTOR(1 to 60) := (others => '0');
        variable Pi : STD_LOGIC := '0';
        variable PS : STD_LOGIC_VECTOR(1 to 60) := P0;
        variable cnt_Wbyte : POSITIVE range 1 to 6 := 1;
        variable cnt_PSbit : POSITIVE range 1 to 61 := 1;

        function PCxor(
            P : STD_LOGIC_VECTOR(60 downto 1);
            C : STD_LOGIC_VECTOR(60 downto 1))
            return STD_LOGIC is
            variable tempxor : STD_LOGIC := '0';
        begin
            for i in 1 to 60 loop
                tempxor := tempxor xor (P(i) and C(i));
            end loop;
            return tempxor;
        end function;

        function LFSR(
            inputX : STD_LOGIC_VECTOR(8 downto 1);
            inputP : STD_LOGIC_VECTOR(60 downto 1);
            inputC : STD_LOGIC_VECTOR(60 downto 1))
            return STD_LOGIC_VECTOR is
            variable P : STD_LOGIC_VECTOR(60 downto 1);
            variable Pi : STD_LOGIC;
        begin
            P := inputP;
            for i in 8 downto 1 loop
                Pi := inputX(i) xor (PCxor(P, inputC));
                P(59 downto 1) := P(60 downto 2);
                P(60) := Pi;
            end loop;
            return P;
        end function;

        function Reverse(reg : STD_LOGIC_VECTOR(0 to 7)) return STD_LOGIC_VECTOR is
            variable temp_reg : STD_LOGIC_VECTOR(0 to 7) := (others => '0');
        begin
            for i in 0 to 7 loop
                temp_reg(i) := reg(7 - i);
            end loop;
            return temp_reg;
        end function;

    begin
        if RESET = '1' then
            lac_board(1 to 64) := x"3FFFFFFF7FFFFFFF";
            current_mem := '0';
            adr_k_cnt := 0;
            Busy <= '0';
            Result <= (others => '0');
            ReportMes <= (others => '0');
            FAR2830 <= "000";
            --------------------------------
            ChipSelect <= '1';
            --------------------------------
            SelMem <= '0';
            D_WK <= (others => '0');
            EnW <= '0';
            Res_Start_FL <= '0';
            FSM <= IDLE;

        elsif rising_edge(CLK) or CLK'event then
            -- ������:
            Res_Start_FL <= '0';
            

            if Sync_Disable = '0' then
                case FSM is

                    when IDLE =>
                        console_buf := null;
                        offset_adrw := W_MIN_ADR;
                        len_reg := 0;
                        adr_d_cnt := 3;
                        adr_k_cnt := W_MAX_ADR;
                        adr_w_cnt := W_MIN_ADR;
                        cnt_Wbyte := 1;
                        cnt_PSbit := 1;
                        d_reg := (others => '0');
                        gcc_reg := (others => '0');
                        w_reg := (others => '0');
                        s_board := (others => '0');
                        s_ground := (others => '0');
                        lac_ground := (others => '0');
                        lac_new := (others => '0');
                        C0 := (others => '0');
                        PS := P0;
                        Pi := '0';
                        flag_changePK := false;
                        temp_result := x"00";
                        Finish <= '0';
                        if Start = '1' then
                            write(console_buf, STRING'(" "));
                            writeline(output, console_buf);
                            ChipSelect <= '1';
                            Busy <= '1';
                            adr_d_cnt := 5;
                            FSM <= TACT_RGCC;
                            ---------------------------
                            Res_Start_FL <= '1'; -- Reset flag  Start
                        end if;

                    when TACT_RGCC =>
                        FSM <= RGCC;

                    when RGCC =>
                        gcc_reg(1 to 16) := gcc_reg(9 to 24);
                        gcc_reg(17 to 24) := D_TC;
                        FSM <= SELCURMEM;

                    when SELCURMEM =>
                        if adr_d_cnt = 7 then
                            if gcc_reg(1 to 16) = b"1111111100000101" then
                                current_mem := '0';
                            elsif gcc_reg(1 to 16) = b"1111111100000110" then
                                current_mem := '1';
                            end if;
                            
                            -- if gcc_reg(9 to 16) = x"05" then
                            -- current_mem := '0';
                            -- elsif gcc_reg(9 to 16) = x"06" then
                            -- current_mem := '1';
                            -- end if;
                            adr_d_cnt := 3;
                            FSM <= TACT_RC;
                        else
                            adr_d_cnt := adr_d_cnt + 1;
                            FSM <= TACT_RGCC;
                        end if;

                    when TACT_RC =>
                        FSM <= RC;

                    when RC =>
                        if adr_k_cnt <= W_MAX_ADR + 8 then
                            C0(9 to 60) := C0(1 to 52);
                            C0(1 to 8) := Reverse(D_K);
                            adr_k_cnt := adr_k_cnt + 1;
                            FSM <= TACT_RC;
                        else
                            write(console_buf, STRING'("    C key:          "));
                            hwrite(console_buf, C0);
                            writeline(output, console_buf);
                            write(console_buf, STRING'("    Input D_TC:     "));
                            adr_k_cnt := W_MIN_ADR;
                            FSM <= TACT_RD;
                        end if;

                    when TACT_RD =>
                        if adr_d_cnt = 3 then
                            len_reg := to_integer(unsigned(D_TC));
                        end if;

                        if len_reg < 16 then
                            temp_result := x"34";
                            writeline(output, console_buf);
                            write(console_buf, STRING'("    Comand type:    Wrong length of TC Segment !"));
                            writeline(output, console_buf);
                            FSM <= REP;
                        else
                            FSM <= RD;
                        end if;

                    when RD =>
                        if adr_d_cnt > 4 then
                            if flag_changePK = true then
                                d_reg := not D_TC;
                            else
                                d_reg := D_TC;
                            end if;
                        end if;
                        FSM <= HASH;

                    when HASH =>
                        if adr_d_cnt < 5 then
                            adr_d_cnt := adr_d_cnt + 1;
                            FSM <= TACT_RD;
                        elsif (adr_d_cnt > 4) and (adr_d_cnt <= len_reg - 7) then
                            if adr_d_cnt <= 10 then
                                lac_new(1 to 24) := lac_new(9 to 32);
                                lac_new(25 to 32) := d_reg;
                            end if;
                            if adr_d_cnt >= len_reg - 7 - 4 then
                                lac_ground(1 to 24) := lac_ground(9 to 32);
                                lac_ground(25 to 32) := d_reg;
                            end if;
                            PS := LFSR(d_reg, PS, C0);
                            adr_d_cnt := adr_d_cnt + 1;
                            hwrite(console_buf, d_reg);
                            write(console_buf, STRING'(" "));
                            FSM <= TACT_RD;
                        elsif (adr_d_cnt > len_reg - 7) and (adr_d_cnt <= len_reg - 2) then
                            if (adr_d_cnt <= len_reg - 4) then
                                PS := LFSR(Z, PS, C0);
                                hwrite(console_buf, Z);
                                write(console_buf, STRING'(" "));
                            end if;
                            s_ground(40 downto 9) := s_ground(32 downto 1);
                            s_ground(8 downto 1) := d_reg;
                            adr_d_cnt := adr_d_cnt + 1;
                            FSM <= TACT_RD;
                        elsif adr_d_cnt = len_reg - 1 then
                            writeline(output, console_buf);
                            write(console_buf, STRING'("    Presignature P: "));
                            hwrite(console_buf, PS);
                            writeline(output, console_buf);
                            adr_d_cnt := 3;
                            FSM <= RW;
                        end if;

                    when TACT_RW =>
                        FSM <= RW;

                    when RW =>
                        w_reg(9 to 48) := w_reg(1 to 40);
                        w_reg(1 to 8) := D_K;
                        FSM <= HKS;

                    when HKS =>
                        if adr_k_cnt <= W_MAX_ADR then
                            if cnt_Wbyte = 6 then
                                cnt_Wbyte := 1;
                                if PS(cnt_PSbit) = '1' then
                                    s_board := STD_LOGIC_VECTOR(unsigned(s_board) + unsigned(w_reg));
                                end if;
                                cnt_PSbit := cnt_PSbit + 1;
                            else
                                cnt_Wbyte := cnt_Wbyte + 1;
                            end if;
                            adr_k_cnt := adr_k_cnt + 1;
                            FSM <= TACT_RW;
                        else
                            cnt_Wbyte := 1;
                            cnt_PSbit := 1;
                            if flag_changePK = false then
                                write(console_buf, STRING'("    Ground LAC:     "));
                                hwrite(console_buf, lac_ground);
                                writeline(output, console_buf);
                                write(console_buf, STRING'("    Board LACs:     "));
                                hwrite(console_buf, lac_board);
                                writeline(output, console_buf);
                                write(console_buf, STRING'("    Ground S:       "));
                                hwrite(console_buf, s_ground);
                                writeline(output, console_buf);
                            end if;
                            write(console_buf, STRING'("    Board S:        "));
                            hwrite(console_buf, s_board(0 to 39));
                            writeline(output, console_buf);
                            if flag_changePK = true then
                                adr_w_cnt := offset_adrw;
                                FSM <= SET_D_WK;
                            else
                                FSM <= STOP;
                            end if;
                        end if;

                    when STOP =>
                        if EnAU = '1' then
                            if s_board(0 to 39) = s_ground then
                                if lac_ground(1 to 2) = "00" and lac_board(1 to 32) = lac_ground then
                                    lac_board(3 to 32) := STD_LOGIC_VECTOR(unsigned(lac_board(3 to 32)) + 1);
                                    FSM <= COM;
                                elsif lac_ground(1 to 2) = "01" and lac_board(33 to 64) = lac_ground then
                                    lac_board(35 to 64) := STD_LOGIC_VECTOR(unsigned(lac_board(35 to 64)) + 1);
                                    FSM <= COM;
                                elsif lac_ground(1 to 2) = "10" and lac_board(65 to 96) = lac_ground then
                                    lac_board(89 to 96) := STD_LOGIC_VECTOR(unsigned(lac_board(89 to 96)) + 1);
                                    FSM <= COM;
                                else
                                    -- �������� �������
                                    write(console_buf, STRING'("    Result:         NOT VALID LAC"));
                                    writeline(output, console_buf);
                                    if gcc_reg(1 to 16) = "1111111100000101" then
                                        current_mem := '1';
                                    elsif gcc_reg(1 to 16) = "1111111100000110" then
                                        current_mem := '0';
                                    end if;
                                    -- if gcc_reg(9 to 16) = x"05" then
                                    -- current_mem := '1';
                                    -- elsif gcc_reg(9 to 16) = x"06" then
                                    -- current_mem := '0';
                                    -- end if;
                                    temp_result := x"03";
                                    FSM <= REP;
                                end if;
                            else
                                -- �������� �������
                                write(console_buf, STRING'("    Result:         NOT VALID S"));
                                writeline(output, console_buf);
                                if gcc_reg(1 to 16) = "1111111100000101" then
                                    current_mem := '1';
                                elsif gcc_reg(1 to 16) = "1111111100000110" then
                                    current_mem := '0';
                                end if;
                                -- if gcc_reg(9 to 16) = x"05" then
                                -- current_mem := '1';
                                -- elsif gcc_reg(9 to 16) = x"06" then
                                -- current_mem := '0';
                                -- end if;
                                temp_result := x"02";
                                FSM <= REP;
                            end if;
                        else
                            -- ��������� ��
                            write(console_buf, STRING'("    Result:         AU DISABLE"));
                            writeline(output, console_buf);
                            if gcc_reg(1 to 16) = "1111111100000101" then
                                current_mem := '1';
                            elsif gcc_reg(1 to 16) = "1111111100000110" then
                                current_mem := '0';
                            end if;
                            -- if gcc_reg(9 to 16) = x"05" then
                            -- current_mem := '1';
                            -- elsif gcc_reg(9 to 16) = x"06" then
                            -- current_mem := '0';
                            -- end if;
                            temp_result := x"01";
                            FSM <= REP;
                        end if;

                    when COM =>
                        write(console_buf, STRING'("    Result:         VALID"));
                        writeline(output, console_buf);
                        write(console_buf, STRING'("    Comand type:    "));
                        if gcc_reg(1 to 8) = x"FF" then

                            if gcc_reg(9 to 16) = x"00" and len_reg = 17 then
                                write(console_buf, STRING'("Dummy Segment"));
                                writeline(output, console_buf);
                                temp_result := x"04";
                                FSM <= REP;

                            elsif gcc_reg(9 to 16) = x"05" and len_reg = 17 then
                                write(console_buf, STRING'("Select Fix key"));
                                writeline(output, console_buf);
                                temp_result := x"54";
                                FSM <= REP;

                            elsif gcc_reg(9 to 16) = x"06" and len_reg = 17 then
                                write(console_buf, STRING'("Select Prog key"));
                                writeline(output, console_buf);
                                temp_result := x"64";
                                FSM <= REP;

                            elsif gcc_reg(9 to 16) = x"07" and len_reg = 17 then
                                write(console_buf, STRING'("Load Fix key in RAM"));
                                writeline(output, console_buf);
                                adr_w_cnt := W_MIN_ADR;
                                adr_k_cnt := W_MIN_ADR;
                                temp_result := x"74";
                                SelMem <= '0';
                                FSM <= TACT_LR;

                            elsif gcc_reg(9 to 16) = x"09" and len_reg = 21 then
                                write(console_buf, STRING'("Set new LAC: "));
                                hwrite(console_buf, lac_new);
                                case lac_new(1 to 2) is
                                    when "00" =>
                                        lac_board(1 to 32) := lac_new;
                                        write(console_buf, STRING'(" Principal"));
                                    when "01" =>
                                        lac_board(33 to 64) := lac_new;
                                        write(console_buf, STRING'(" Auxiliary"));
                                    when "10" =>
                                        lac_board(89 to 96) := lac_new(25 to 32);
                                        write(console_buf, STRING'(" Recovery"));
                                    when others => FSM <= REP;
                                end case;
                                writeline(output, console_buf);
                                temp_result := x"94";
                                FSM <= REP;

                            elsif gcc_reg(9 to 16) = x"0A" and len_reg = 25 then
                                offset_adrw := offset_adrw + to_integer(unsigned(gcc_reg(17 to 24)));
                                write(console_buf, STRING'("Change PK A Block"));
                                writeline(output, console_buf);
                                write(console_buf, STRING'("    Input D_TC:     "));
                                flag_changePK := true;
                                PS := P0;
                                w_reg := (others => '0');
                                s_board := (others => '0');
                                adr_k_cnt := W_MIN_ADR;
                                temp_result := x"A4";
                                FSM <= TACT_RD;

                            elsif gcc_reg(9 to 16) = x"0B" and gcc_reg(17 to 24) <= x"6F" and len_reg = 25 then
                                offset_adrw := offset_adrw + to_integer(unsigned(gcc_reg(17 to 24))) + 256;
                                write(console_buf, STRING'("Change PK B Block"));
                                writeline(output, console_buf);
                                write(console_buf, STRING'("    Input D_TC:     "));
                                flag_changePK := true;
                                PS := P0;
                                w_reg := (others => '0');
                                s_board := (others => '0');
                                adr_k_cnt := W_MIN_ADR;
                                temp_result := x"B4";
                                FSM <= TACT_RD;

                            else
                                write(console_buf, STRING'("Wrong format ACC !"));
                                writeline(output, console_buf);
                                if gcc_reg(1 to 16) = "1111111100000101" then
                                    current_mem := '1';
                                elsif gcc_reg(1 to 16) = "1111111100000110" then
                                    current_mem := '0';
                                end if;
                                -- if gcc_reg(9 to 16) = x"05" then
                                -- current_mem := '1';
                                -- elsif gcc_reg(9 to 16) = x"06" then
                                -- current_mem := '0';
                                -- end if;
                                temp_result := x"24";
                                FSM <= REP;
                            end if;

                        else
                            write(console_buf, STRING'("Data Segment"));
                            writeline(output, console_buf);
                            temp_result := x"14";
                            FSM <= REP;
                            -- elsif gcc_reg(1 to 8) = x"99" then -- �������������� 
                            --     write(console_buf, STRING'("Regular"));
                            --     writeline(output, console_buf);
                            --     temp_result := x"14";
                            --     FSM <= REP;

                            -- else
                            --     write(console_buf, STRING'("Wrong command!"));
                            --     writeline(output, console_buf);
                            --     if gcc_reg(9 to 16) = x"05" then
                            --         current_mem := '1';
                            --     elsif gcc_reg(9 to 16) = x"06" then
                            --         current_mem := '0';
                            --     end if;
                            --     temp_result := x"24";
                            --     FSM <= REP;
                        end if;

                    when REP =>
                        Finish <= '1';
                        Busy <= '0';
                        ChipSelect <= '0';
                        ReportMes <= lac_board(1 to 64) & current_mem & "0000000" & lac_board(89 to 96);
                        Result <= temp_result;
                        case temp_result is
                            when x"14" => FAR2830 <= b"001"; -- Authorised data segment 
                            when x"54" => FAR2830 <= b"010"; -- Authorised (and executable) Authentication Control Command 
                            when x"64" => FAR2830 <= b"010"; -- Authorised (and executable) Authentication Control Command 
                            when x"74" => FAR2830 <= b"010"; -- Authorised (and executable) Authentication Control Command 
                            when x"94" => FAR2830 <= b"010"; -- Authorised (and executable) Authentication Control Command 
                            when x"A4" => FAR2830 <= b"010"; -- Authorised (and executable) Authentication Control Command 
                            when x"B4" => FAR2830 <= b"010"; -- Authorised (and executable) Authentication Control Command 
                            when x"04" => FAR2830 <= b"011"; -- Authorised �dummy segment�
                            when x"02" => FAR2830 <= b"100"; -- Error in Signature 
                            when x"03" => FAR2830 <= b"101"; -- Error in LAC
                            when x"24" => FAR2830 <= b"110"; -- Wrong format (not executable) of authorised Authentication Control Command (includes Segment Header)
                            when x"34" => FAR2830 <= b"111"; -- Wrong length of TC Segment prior to being authenticated (authorised), i.e. length shorter than 10 octets 
                            when others =>
                        end case;
                        write(console_buf, STRING'("    REPORTMES:      "));
                        hwrite(console_buf, lac_board(1 to 64) & current_mem & "0000000" & lac_board(89 to 96));
                        writeline(output, console_buf);
                        write(console_buf, STRING'(" "));
                        writeline(output, console_buf);
                        FSM <= IDLE;

                        ----------------------------- Loading Fix Key -----------------------------
                    when SET_ADR_LR =>
                        EnW <= '0';
                        if adr_w_cnt < W_MAX_ADR + 8 then
                            adr_k_cnt := adr_k_cnt + 1;
                            adr_w_cnt := adr_w_cnt + 1;
                            FSM <= TACT_LR;
                        else
                            FSM <= REP;
                        end if;
                    when TACT_LR =>
                        FSM <= SET_D_TC_LR;
                    when SET_D_TC_LR =>
                        D_WK <= D_K;
                        FSM <= LR;
                    when LR =>
                        EnW <= '1';
                        FSM <= SET_ADR_LR;

                        ------------------------------------ Change PK ----------------------------
                    when SET_ADR_WK =>
                        adr_w_cnt := adr_w_cnt + 1;
                        EnW <= '0';
                        FSM <= SET_D_WK;
                    when SET_D_WK =>
                        if adr_w_cnt = offset_adrw + 5 or adr_w_cnt = W_MAX_ADR + 9 then
                            flag_changePK := false;
                            FSM <= REP;
                        elsif adr_w_cnt < offset_adrw + 5 then
                            if adr_w_cnt = W_MAX_ADR + 1 then
                                s_board(32 to 35) := "0000";
                            end if;
                            D_WK <= s_board(32 to 39);
                            s_board(8 to 39) := s_board(0 to 31);
                            FSM <= WK;
                        end if;
                    when WK =>
                        EnW <= '1';
                        FSM <= SET_ADR_WK;
                        ---------------------------------------------------------------------------
                    when others =>
                end case;
            end if;
        end if;

        if gcc_reg(1 to 16) /= x"FF07" then
            SelMem <= current_mem;
        end if;
        Adr_D <= STD_LOGIC_VECTOR(to_unsigned(adr_d_cnt, 9));
        Adr_K <= STD_LOGIC_VECTOR(to_unsigned(adr_k_cnt, 10));
        Adr_WK <= STD_LOGIC_VECTOR(to_unsigned(adr_w_cnt, 10));

    end process;
end architecture;