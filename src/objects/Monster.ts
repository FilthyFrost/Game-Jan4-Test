/**
 * Monster - 怪物基类
 * 
 * 管理单个怪物的状态、动画和移动逻辑
 */

import Phaser from 'phaser';
import { GameConfig } from '../config';

export type MonsterType = 'A01';

export interface MonsterConfig {
    type: MonsterType;
    x: number;
    y: number;          // 世界Y坐标 (越小=越高)
    heightMeters: number; // 高度 (米)
    speedMultiplier?: number; // 速度倍率 (默认1.0)
}

export class Monster {
    public scene: Phaser.Scene;
    public sprite: Phaser.GameObjects.Sprite;

    // 位置和状态
    public x: number;
    public y: number;
    public heightMeters: number;
    public type: MonsterType;
    public isAlive: boolean = true;

    // 通道系统
    public currentLane: number = 1;  // 0=左, 1=中, 2=右 (创建时固定，不会改变)
    private screenWidth: number;

    // 移动AI
    private moveDirection: -1 | 1 = 1;  // -1=左, 1=右
    private moveSpeed: number = 40;
    private speedMultiplier: number = 1.0; // 速度倍率 (高度越高越快)
    private nextDirectionChange: number = 0;

    constructor(scene: Phaser.Scene, config: MonsterConfig, screenWidth: number) {
        this.scene = scene;
        this.x = config.x;
        this.y = config.y;
        this.heightMeters = config.heightMeters;
        this.type = config.type;
        this.screenWidth = screenWidth;
        this.speedMultiplier = config.speedMultiplier ?? 1.0;

        // 创建精灵
        const size = GameConfig.monster.a01.size;
        this.sprite = scene.add.sprite(this.x, this.y, 'monster_a01_right_1')
            .setDisplaySize(size, size)
            .setDepth(5);

        // 随机初始方向
        this.moveDirection = Math.random() > 0.5 ? 1 : -1;
        this.updateMoveSpeed();

        // 设置下次方向改变时间
        this.scheduleDirectionChange();

        // 根据X位置计算初始通道
        this.updateCurrentLane();

        // 播放初始动画
        this.playDirectionAnimation();
    }

    /**
     * 更新移动速度 (考虑高度倍率)
     */
    private updateMoveSpeed(): void {
        const baseSpeed = Phaser.Math.Between(
            GameConfig.monster.moveSpeedMin,
            GameConfig.monster.moveSpeedMax
        );
        this.moveSpeed = baseSpeed * this.speedMultiplier;
    }

    /**
     * 更新怪物状态
     */
    public update(dt: number, currentTime: number): void {
        if (!this.isAlive) return;

        // 检查是否需要改变方向
        if (currentTime >= this.nextDirectionChange) {
            this.changeDirection();
        }

        // 移动
        const moveAmount = this.moveDirection * this.moveSpeed * dt;
        this.x += moveAmount;

        // ===== 边界检查 - 怪物只能在自己通道内活动 =====
        // 设计理念：怪物只在自己所在通道内左右移动，不会跑到其他通道
        // 这样玩家换道到怪物所在通道时，一定能打到
        const laneCount = GameConfig.lane.count ?? 3;
        const laneWidth = this.screenWidth / laneCount;
        
        // 计算当前通道的边界 - 25%边距确保怪物始终在攻击范围内
        const laneLeftBound = this.currentLane * laneWidth + laneWidth * 0.25;   // 通道左边界（留25%边距）
        const laneRightBound = (this.currentLane + 1) * laneWidth - laneWidth * 0.25; // 通道右边界（留25%边距）
        
        if (this.x < laneLeftBound) {
            this.x = laneLeftBound;
            this.changeDirection();
        } else if (this.x > laneRightBound) {
            this.x = laneRightBound;
            this.changeDirection();
        }

        // 更新精灵位置
        this.sprite.setPosition(this.x, this.y);

        // 注意：不再更新通道，怪物固定在创建时的通道内活动
    }

    /**
     * 根据X位置计算当前通道
     */
    private updateCurrentLane(): void {
        const laneWidth = this.screenWidth / GameConfig.lane.count;
        const newLane = Math.floor(this.x / laneWidth);
        this.currentLane = Phaser.Math.Clamp(newLane, 0, GameConfig.lane.count - 1);
    }

    /**
     * 改变移动方向
     */
    private changeDirection(): void {
        this.moveDirection = this.moveDirection === 1 ? -1 : 1;
        this.updateMoveSpeed();
        this.scheduleDirectionChange();
        this.playDirectionAnimation();
    }

    /**
     * 安排下次方向改变
     */
    private scheduleDirectionChange(): void {
        const interval = GameConfig.monster.directionChangeInterval;
        const variance = GameConfig.monster.directionChangeVariance;
        const delay = interval + Phaser.Math.Between(-variance, variance);
        this.nextDirectionChange = this.scene.time.now + Math.max(500, delay);
    }

    /**
     * 播放对应方向的动画
     */
    private playDirectionAnimation(): void {
        const animKey = this.moveDirection === 1 ? 'monster_a01_right' : 'monster_a01_left';
        if (this.sprite.anims.currentAnim?.key !== animKey) {
            this.sprite.play(animKey);
        }
    }

    /**
     * 击杀怪物
     */
    public kill(): void {
        if (!this.isAlive) return;
        this.isAlive = false;

        // 简单的死亡效果 - 淡出
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            scale: 1.5,
            duration: 200,
            onComplete: () => {
                this.sprite.destroy();
            }
        });
    }

    /**
     * 销毁怪物 (不播放动画)
     */
    public destroy(): void {
        this.isAlive = false;
        this.sprite.destroy();
    }
}
